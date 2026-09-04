import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { FormStatus } from '../database/entities/form.entity';
import {
  PublicationEntity,
  PublicationType,
} from '../database/entities/publication.entity';
import {
  ResponseEntity,
  ResponseStatus,
} from '../database/entities/response.entity';
import { LogicEngineService } from '../forms/logic-engine.service';
import { LogicRuntimeService } from '../forms/logic-runtime.service';
import type { FormStructure } from '../forms/logic-types';
import { type FormTheme, resolveTheme } from '../forms/theme';
import { ScoreEngineService } from '../forms/score-engine.service';
import { PlanService } from '../plans/plan.service';
import { SaveProgressDto, SubmitResponseDto } from './dto';
import { RespondentAuthService } from './respondent-auth.service';
import { validateAnswers } from './answer-validator';
import {
  PlatformSettingsService,
  type PublicFooter,
} from '../platform/platform-settings.service';

type PublicFormPayload = {
  publicationId: string;
  formId: string;
  organizationId: string;
  formTitle: string;
  formVersionId: string;
  structure: Record<string, unknown>;
  settings: Record<string, unknown>;
  /** کلید تاییدشده در OTP، در صورت وجود. */
  verifiedRespondentKey?: string | null;
  /** ظاهر فرم؛ پاک‌سازی‌شده و آماده‌ی اعمال. */
  theme: FormTheme;
  /** نوار پایین سکو؛ فقط سوپرادمین آن را تنظیم می‌کند. */
  footer: PublicFooter;
};

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(PublicationEntity)
    private readonly publicationRepo: Repository<PublicationEntity>,
    @InjectRepository(FormVersionEntity)
    private readonly versionRepo: Repository<FormVersionEntity>,
    @InjectRepository(ResponseEntity)
    private readonly responseRepo: Repository<ResponseEntity>,
    @InjectRepository(AnswerFlatEntity)
    private readonly answerFlatRepo: Repository<AnswerFlatEntity>,
    private readonly planService: PlanService,
    private readonly scoreEngine: ScoreEngineService,
    private readonly logicEngine: LogicEngineService,
    private readonly logicRuntime: LogicRuntimeService,
    private readonly respondentAuth: RespondentAuthService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  /**
   * گام بعدی پاسخ‌دهنده: صفحه‌ی بعد با اعمال قوانین پرش،
   * سوالات قابل نمایش آن، و متن‌های Piping‌شده.
   */
  async nextStepByToken(
    token: string,
    dto: {
      currentPageId?: string | null;
      answers?: Record<string, unknown>;
      params?: Record<string, unknown>;
    },
    accessToken?: string,
  ) {
    const formData = await this.getByToken(token, accessToken);
    const structure = formData.structure as FormStructure;
    const answers = dto.answers ?? {};
    const params = dto.params ?? {};
    // شاخص‌ها با پاسخ‌های فعلی محاسبه می‌شوند تا شرط‌های مبتنی بر
    // شاخص (بند ۶ سند) در همان لحظه قابل ارزیابی باشند.
    const scores = this.scoreEngine.calculate(structure, answers);
    const context = { answers, params, scores };

    const step = this.logicRuntime.nextStep(
      structure,
      dto.currentPageId ?? null,
      context,
    );

    if (step.finished || !step.nextPageId) {
      return { ...step, page: null, scores };
    }

    return {
      ...step,
      scores,
      page: this.renderPage(structure, step.nextPageId, context),
    };
  }

  /**
   * یک صفحه‌ی مشخص با وضعیت نمایش فعلی.
   *
   * پاسخ‌دهنده هنگام پر کردن همان صفحه ممکن است سوالی را فعال یا غیرفعال
   * کند؛ کلاینت با این اندپوینت صفحه‌ی جاری را تازه می‌کند بدون اینکه
   * منطق را خودش پیاده‌سازی کند.
   */
  async resolvePageByToken(
    token: string,
    pageId: string,
    dto: {
      answers?: Record<string, unknown>;
      params?: Record<string, unknown>;
    },
    accessToken?: string,
  ) {
    const formData = await this.getByToken(token, accessToken);
    const structure = formData.structure as FormStructure;
    const answers = dto.answers ?? {};
    const params = dto.params ?? {};
    const scores = this.scoreEngine.calculate(structure, answers);
    const context = { answers, params, scores };

    const page = this.renderPage(structure, pageId, context);
    if (!page) throw new NotFoundException('صفحه یافت نشد');

    const pages = structure.pages ?? [];
    return {
      page,
      scores,
      isFirstPage: pages[0]?.id === pageId,
    };
  }

  /** صفحه را با فیلتر نمایش و Piping آماده‌ی نمایش می‌کند. */
  private renderPage(
    structure: FormStructure,
    pageId: string,
    context: {
      answers: Record<string, unknown>;
      params: Record<string, unknown>;
      scores: Record<string, number>;
    },
  ) {
    const page = (structure.pages ?? []).find((p) => p.id === pageId);
    if (!page) return null;

    const visible = this.logicRuntime.visibleQuestionIds(structure, context);
    const pipe = (text: string) =>
      this.logicEngine.applyPiping(text, context.answers, context.params);

    return {
      ...page,
      title: pipe(String(page.title ?? '')),
      questions: (page.questions ?? [])
        .filter((q) => visible.has(q.id))
        .map((q) => ({
          ...q,
          title: pipe(String(q.title ?? '')),
          description: q.description
            ? pipe(String(q.description))
            : q.description,
        })),
    };
  }

  /**
   * فرم را با توکن تصادفی یا نشانی اختصاصی پیدا می‌کند.
   * هر دو راه معتبرند تا لینک‌های پخش‌شده‌ی قبلی با افزودن نشانی
   * اختصاصی نشکنند.
   */
  async getByToken(
    token: string,
    accessToken?: string,
  ): Promise<PublicFormPayload> {
    const publication = await this.findPublication(token);

    if (!publication || !publication.isActive)
      throw new NotFoundException('لینک معتبر نیست');

    if (publication.expiresAt && publication.expiresAt < new Date()) {
      throw new BadRequestException('مهلت پاسخگویی این لینک تمام شده است');
    }

    // فرم‌های رمزدار یا OTP‌دار بدون اعتبار معتبر باز نمی‌شوند.
    const auth = this.respondentAuth.verifyAccess(publication, accessToken);

    const latestVersion = await this.versionRepo.findOne({
      where: { formId: publication.formId },
      order: { version: 'DESC' },
    });

    if (!latestVersion) throw new NotFoundException('نسخه فرم یافت نشد');

    return {
      publicationId: publication.id,
      formId: publication.formId,
      organizationId: publication.form.workspace.organizationId,
      formTitle: publication.form.title,
      formVersionId: latestVersion.id,
      structure: latestVersion.structure,
      settings: publication.form.settings,
      theme: resolveTheme(publication.form.settings),
      footer: await this.platformSettings.publicFooter(),
      // کلید تاییدشده در OTP، تا کنترل تکرار بر همان مبنا کار کند.
      verifiedRespondentKey: auth?.respondentKey ?? null,
    };
  }

  /**
   * فرم را برمی‌گرداند و باز شدنش را می‌شمارد.
   *
   * شمارش عمدا اینجاست نه در getByToken: آن متد را مسیرهای دیگر (گام بعد،
   * ثبت پاسخ، ذخیره‌ی پیشرفت) هم صدا می‌زنند و بازدید چند برابر می‌شد.
   */
  async openForm(token: string, accessToken?: string) {
    const payload = await this.getByToken(token, accessToken);
    /*
     * منتظر نوشتن شمارنده نمی‌مانیم.
     *
     * این یک آمار است نه یک تعهد؛ اگر نوشتنش شکست بخورد نباید نمایش فرم
     * به پاسخ‌دهنده کند یا خراب شود.
     */
    void this.publicationRepo
      .increment({ id: payload.publicationId }, 'viewCount', 1)
      .catch(() => undefined);

    return payload;
  }

  /** انتشار را با توکن تصادفی یا نشانی اختصاصی پیدا می‌کند. */
  private findPublication(token: string) {
    return this.publicationRepo
      .findOne({
        where: { token },
        relations: { form: { workspace: true } },
      })
      .then(
        (byToken) =>
          byToken ??
          this.publicationRepo.findOne({
            where: { slug: token.toLowerCase() },
            relations: { form: { workspace: true } },
          }),
      );
  }

  /** اطلاعات لازم برای صفحه‌ی ورود، پیش از احراز هویت. */
  async getAuthInfo(token: string) {
    const publication = await this.findPublication(token);
    if (!publication || !publication.isActive) {
      throw new NotFoundException('لینک معتبر نیست');
    }

    return {
      publicationId: publication.id,
      authMode: publication.authMode,
      requiresAuth: this.respondentAuth.requiresAuth(publication),
    };
  }

  async loginWithPassword(token: string, password: string) {
    const publication = await this.findPublication(token);
    if (!publication) throw new NotFoundException('لینک معتبر نیست');
    return this.respondentAuth.loginWithPassword(publication, password);
  }

  async requestOtp(token: string, destination: string) {
    const publication = await this.findPublication(token);
    if (!publication) throw new NotFoundException('لینک معتبر نیست');
    return this.respondentAuth.requestOtp(publication, destination);
  }

  async verifyOtp(token: string, destination: string, code: string) {
    const publication = await this.findPublication(token);
    if (!publication) throw new NotFoundException('لینک معتبر نیست');
    return this.respondentAuth.verifyOtp(publication, destination, code);
  }

  async getPortalForms(organizationId: string) {
    const publications = await this.publicationRepo.find({
      where: {
        type: In([PublicationType.PORTAL, PublicationType.LINK]),
        isActive: true,
        form: {
          status: FormStatus.ACTIVE,
          workspace: { organizationId },
        },
      },
      relations: { form: { workspace: true } },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    return publications.map((publication) => ({
      publicationId: publication.id,
      formId: publication.formId,
      formTitle: publication.form.title,
      type: publication.type,
      token: publication.token,
      url: `/f/${publication.token}`,
      tags: publication.tags ?? [],
      expiresAt: publication.expiresAt,
    }));
  }

  async getProgressByToken(
    token: string,
    respondentKey: string,
    accessToken?: string,
  ) {
    const formData = await this.getByToken(token, accessToken);
    const response = await this.responseRepo.findOne({
      where: {
        publicationId: formData.publicationId,
        respondentKey,
        status: ResponseStatus.PARTIAL,
      },
      order: { createdAt: 'DESC' },
    });

    return {
      respondentKey,
      answers: response?.answers ?? {},
      meta: response?.meta ?? {},
      exists: Boolean(response),
    };
  }

  async saveProgressByToken(
    token: string,
    dto: SaveProgressDto,
    accessToken?: string,
  ) {
    const formData = await this.getByToken(token, accessToken);
    const respondentKey = this.resolveRespondentKey(
      dto.respondentKey,
      dto.meta,
    );

    if (!respondentKey) {
      throw new BadRequestException(
        'برای ذخیره پیشرفت، respondentKey لازم است',
      );
    }

    const existing = await this.responseRepo.findOne({
      where: {
        publicationId: formData.publicationId,
        respondentKey,
        status: ResponseStatus.PARTIAL,
      },
      order: { createdAt: 'DESC' },
    });

    const progress = existing
      ? Object.assign(existing, {
          answers: dto.answers,
          meta: dto.meta ?? existing.meta,
        })
      : this.responseRepo.create({
          formVersionId: formData.formVersionId,
          publicationId: formData.publicationId,
          respondentKey,
          status: ResponseStatus.PARTIAL,
          startedAt: new Date(),
          submittedAt: null,
          durationSeconds: null,
          meta: dto.meta ?? {},
          answers: dto.answers,
          scores: {},
        });

    const saved = await this.responseRepo.save(progress);
    return { id: saved.id, status: saved.status };
  }

  async submitByToken(
    token: string,
    dto: SubmitResponseDto,
    accessToken?: string,
  ) {
    const formData = await this.getByToken(token, accessToken);
    const respondentKey = this.resolveRespondentKey(
      dto.respondentKey,
      dto.meta,
    );

    await this.ensureNotDuplicate(
      formData.publicationId,
      formData.settings,
      respondentKey,
    );

    const quota = await this.planService.canAcceptResponse(
      formData.organizationId,
    );
    if (!quota.allowed) {
      throw new BadRequestException(
        quota.reason ?? 'سقف پاسخ‌نامه پلن تکمیل شده است',
      );
    }

    const startedAt = new Date();
    const submittedAt = new Date();
    const structure = formData.structure as FormStructure;

    // پاسخ سوالاتی که با منطق نمایش پنهان بوده‌اند ذخیره نمی‌شود؛
    // در غیر این صورت کلاینت می‌تواند پاسخ سوالی را بفرستد که هرگز ندیده است.
    const params = (dto.meta?.params ?? {}) as Record<string, unknown>;
    const preliminaryScores = this.scoreEngine.calculate(
      structure,
      dto.answers,
    );
    const answers = this.logicRuntime.stripHiddenAnswers(
      structure,
      dto.answers,
      params,
      preliminaryScores,
    );
    // شاخص نهایی روی پاسخ‌های پاک‌سازی‌شده محاسبه می‌شود.
    const scores = this.scoreEngine.calculate(structure, answers);

    /*
     * اعتبارسنجی سمت سرور.
     *
     * اعتبارسنجی مرورگر با یک درخواست مستقیم به API کاملا دور زده می‌شود،
     * پس تنها جای قابل اتکا همین‌جاست. فقط سوال‌هایی سنجیده می‌شوند که
     * پس از اعمال منطق شرطی واقعا به پاسخ‌دهنده نشان داده شده‌اند.
     */
    const visible = this.logicRuntime.visibleQuestionIds(structure, {
      answers,
      params,
      scores,
    });
    const allQuestions = (structure.pages ?? []).flatMap(
      (page) => page.questions ?? [],
    );
    const problems = validateAnswers(allQuestions, answers, visible);
    if (problems.length > 0) {
      throw new BadRequestException({
        message: problems[0].message,
        errors: problems,
      });
    }

    let response: ResponseEntity | null = null;
    if (respondentKey) {
      response = await this.responseRepo.findOne({
        where: {
          publicationId: formData.publicationId,
          respondentKey,
          status: ResponseStatus.PARTIAL,
        },
        order: { createdAt: 'DESC' },
      });
    }

    if (response) {
      response.status = ResponseStatus.COMPLETED;
      response.submittedAt = submittedAt;
      response.durationSeconds = Math.max(
        0,
        Math.floor(
          (submittedAt.getTime() - response.startedAt.getTime()) / 1000,
        ),
      );
      response.answers = answers;
      response.meta = dto.meta ?? response.meta;
      response.respondentKey = respondentKey ?? response.respondentKey;
      response.scores = scores;
      response = await this.responseRepo.save(response);
    } else {
      response = await this.responseRepo.save(
        this.responseRepo.create({
          formVersionId: formData.formVersionId,
          publicationId: formData.publicationId,
          respondentKey: respondentKey ?? null,
          status: ResponseStatus.COMPLETED,
          startedAt,
          submittedAt,
          durationSeconds: 0,
          meta: dto.meta ?? {},
          answers,
          scores,
        }),
      );
    }

    await this.answerFlatRepo.delete({ responseId: response.id });
    const rows = this.mapAnswersToFlatRows(response.id, answers);
    if (rows.length) {
      await this.answerFlatRepo.save(rows);
    }

    await this.planService.trackUsage(
      formData.organizationId,
      'response_submitted',
      1,
    );

    return { id: response.id, status: 'completed', scores };
  }

  private mapAnswersToFlatRows(
    responseId: string,
    answers: Record<string, unknown>,
  ) {
    return Object.entries(answers).flatMap(([questionId, value]) => {
      if (Array.isArray(value)) {
        return value.map((item) =>
          this.answerFlatRepo.create({
            responseId,
            questionId,
            valueText: typeof item === 'string' ? item : JSON.stringify(item),
            valueNumber: typeof item === 'number' ? item : null,
            choiceId: typeof item === 'string' ? item : null,
          }),
        );
      }

      if (typeof value === 'object' && value !== null) {
        return [
          this.answerFlatRepo.create({
            responseId,
            questionId,
            valueText: JSON.stringify(value),
            valueNumber: null,
            choiceId: null,
          }),
        ];
      }

      return [
        this.answerFlatRepo.create({
          responseId,
          questionId,
          valueText: typeof value === 'string' ? value : JSON.stringify(value),
          valueNumber: typeof value === 'number' ? value : null,
          choiceId: typeof value === 'string' ? value : null,
        }),
      ];
    });
  }

  private resolveRespondentKey(
    respondentKey?: string,
    meta?: Record<string, unknown>,
  ): string | null {
    const metaKey = meta?.respondentKey;
    if (typeof respondentKey === 'string' && respondentKey.trim()) {
      return respondentKey.trim();
    }
    if (typeof metaKey === 'string' && metaKey.trim()) {
      return metaKey.trim();
    }
    return null;
  }

  private async ensureNotDuplicate(
    publicationId: string,
    settings: Record<string, unknown>,
    respondentKey: string | null,
  ) {
    const preventDuplicate = Boolean(settings.preventDuplicate);
    if (!preventDuplicate || !respondentKey) return;

    const existing = await this.responseRepo.findOne({
      where: {
        publicationId,
        respondentKey,
        status: ResponseStatus.COMPLETED,
      },
    });

    if (existing) {
      throw new BadRequestException('پاسخ تکراری مجاز نیست');
    }
  }

  applyPipingText(
    text: string,
    answers: Record<string, unknown>,
    params: Record<string, unknown>,
  ) {
    return this.logicEngine.applyPiping(text, answers, params);
  }
}
