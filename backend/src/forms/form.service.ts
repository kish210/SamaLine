import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import {
  ResponseEntity,
  ResponseStatus,
} from '../database/entities/response.entity';
import {
  PublicationAuthMode,
  PublicationEntity,
  PublicationType,
} from '../database/entities/publication.entity';
import { PlanService } from '../plans/plan.service';
import { ALL_QUESTION_TYPES } from '../types/form-types';
import {
  CreateFormDto,
  CreatePublicationDto,
  FormPageDto,
  FormQuestionDto,
  UpdateFormDto,
} from './dto';
import { findTemplate } from '../templates/form-templates';
import { LogicEngineService } from './logic-engine.service';
import type { FormStructure } from './logic-types';
import { validateSlug } from './slug';

/** آرایه بودن یک مقدار ناشناخته، بدون تکرار شرط در چند جا. */
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

@Injectable()
export class FormService {
  constructor(
    @InjectRepository(FormEntity)
    private readonly formRepo: Repository<FormEntity>,
    @InjectRepository(FormVersionEntity)
    private readonly versionRepo: Repository<FormVersionEntity>,
    @InjectRepository(PublicationEntity)
    private readonly publicationRepo: Repository<PublicationEntity>,
    @InjectRepository(ResponseEntity)
    private readonly responseRepo: Repository<ResponseEntity>,
    private readonly planService: PlanService,
    private readonly logicEngine: LogicEngineService,
  ) {}

  /**
   * فرم‌های یک فضای کاری.
   *
   * فرم بایگانی‌شده پیش‌فرض نمی‌آید؛ بایگانی برای این است که از جلوی چشم
   * برداشته شود، ولی با `includeArchived` باز هم قابل دیدن است.
   */
  async list(workspaceId: string, includeArchived = false) {
    const all = await this.formRepo.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
    const forms = includeArchived
      ? all
      : all.filter((form) => form.status !== FormStatus.ARCHIVED);
    if (!forms.length) return [];

    /*
     * تعداد پاسخ کامل و زمان آخرین پاسخ هر فرم، با یک کوئری گروه‌بندی‌شده.
     *
     * کارت فرم در پنل بدون این فقط عنوان و نشانک داخلی نشان می‌داد؛ کاربر
     * برای دیدن اینکه فرمی پاسخ گرفته یا نه باید تک‌تک بازشان می‌کرد.
     */
    const stats = await this.responseRepo
      .createQueryBuilder('response')
      .innerJoin('response.publication', 'publication')
      .select('publication.formId', 'formId')
      .addSelect('COUNT(response.id)', 'count')
      .addSelect('MAX(response.submittedAt)', 'lastAt')
      .where('publication.formId IN (:...ids)', {
        ids: forms.map((form) => form.id),
      })
      .andWhere('response.status = :status', {
        status: ResponseStatus.COMPLETED,
      })
      .groupBy('publication.formId')
      .getRawMany<{
        formId: string;
        count: string | number;
        lastAt: string | Date | null;
      }>();
    const byForm = new Map(stats.map((row) => [row.formId, row]));

    return forms.map((form) => {
      const row = byForm.get(form.id);
      return {
        ...form,
        responseCount: Number(row?.count ?? 0),
        lastResponseAt: row?.lastAt ? new Date(row.lastAt).toISOString() : null,
      };
    });
  }

  /**
   * بایگانی یا بازگرداندن فرم.
   *
   * بایگانی برگشت‌پذیر است و هیچ داده‌ای را از بین نمی‌برد؛ فرم فقط از
   * فهرست کنار می‌رود و لینک‌هایش هم بسته می‌شوند.
   */
  async setArchived(id: string, archived: boolean) {
    const form = await this.formRepo.findOne({ where: { id } });
    if (!form) throw new NotFoundException('فرم یافت نشد');

    form.status = archived ? FormStatus.ARCHIVED : FormStatus.DRAFT;
    await this.formRepo.save(form);

    // لینک فرم بایگانی‌شده نباید پاسخ تازه بگیرد.
    await this.publicationRepo.update({ formId: id }, { isActive: !archived });

    return this.get(id);
  }

  /** چند پاسخ روی این فرم ثبت شده؟ مبنای تایید حذف. */
  async responseCount(id: string): Promise<number> {
    return this.responseRepo
      .createQueryBuilder('response')
      .innerJoin('response.formVersion', 'version')
      .where('version.formId = :id', { id })
      .getCount();
  }

  /**
   * حذف همیشگی فرم و همه‌ی پاسخ‌هایش.
   *
   * `acknowledgedResponses` باید با تعداد واقعی پاسخ‌ها برابر باشد. این
   * فقط سخت‌گیری نیست: پاسخ‌ها با CASCADE پاک می‌شوند و برگشتی ندارند، و
   * عددِ نادرست یعنی کاربر (یا رابطی که عدد کهنه نشان داده) نمی‌داند دارد
   * چه چیزی را از بین می‌برد.
   */
  async remove(id: string, acknowledgedResponses: number) {
    const form = await this.formRepo.findOne({ where: { id } });
    if (!form) throw new NotFoundException('فرم یافت نشد');

    const actual = await this.responseCount(id);
    if (actual !== acknowledgedResponses) {
      throw new BadRequestException(
        `این فرم ${actual} پاسخ دارد؛ برای حذف همیشگی باید همین عدد تایید شود.`,
      );
    }

    await this.formRepo.delete({ id });
    return { ok: true, deletedResponses: actual };
  }

  async create(dto: CreateFormDto) {
    // قالب فقط جای خالی‌ها را پر می‌کند؛ هرچه در درخواست آمده مقدم است.
    const template = dto.templateKey
      ? findTemplate(dto.templateKey)
      : undefined;
    if (dto.templateKey && !template) {
      throw new BadRequestException('قالب انتخاب‌شده وجود ندارد');
    }

    const pages = this.resolvePages(
      dto.pages ?? (template?.structure.pages as FormPageDto[] | undefined),
      dto.questions,
    );
    await this.validatePages(pages, dto.workspaceId);

    /*
     * ساختار درخواستی: آنچه کاربر فرستاده مقدم است و قالب فقط جای خالی را
     * پر می‌کند. هرچه کاربر خودش نوشته باشد باید در پلنش بگنجد؛ آنچه از
     * قالب آمده، اگر نگنجد کنار گذاشته می‌شود.
     */
    const draft = {
      logic: dto.logic ?? template?.structure.logic,
      scoreConfig:
        dto.scoreConfig ??
        (template?.structure.scoreIndexes
          ? { indices: template.structure.scoreIndexes }
          : undefined),
      settings: dto.settings ?? template?.settings,
    };
    const fromTemplateOnly =
      Boolean(template) && !dto.logic && !dto.scoreConfig;
    const trimmed = fromTemplateOnly
      ? await this.trimTemplateToPlan(dto.workspaceId, draft)
      : { ...draft, skipped: [] as string[] };

    this.validateLogic(trimmed.logic, pages);
    await this.assertStructurePlan(dto.workspaceId, trimmed);
    const planCheck = await this.planService.canCreateForm(dto.workspaceId);
    if (!planCheck.allowed) {
      throw new BadRequestException(
        planCheck.reason ?? 'پلن اجازه ساخت فرم جدید نمی‌دهد',
      );
    }

    const form = await this.formRepo.save(
      this.formRepo.create({
        workspaceId: dto.workspaceId,
        title: dto.title,
        slug: dto.slug,
        status: FormStatus.DRAFT,
        settings: trimmed.settings ?? {
          theme: 'default',
          languages: ['fa'],
          startPageEnabled: true,
          endPageEnabled: true,
          startPageText: 'به نظرسنجی خوش آمدید',
          endPageText: 'از مشارکت شما سپاسگزاریم',
          allowEditAnswer: false,
          displayMode: 'single',
          preventDuplicate: false,
          saveProgress: true,
        },
      }),
    );

    await this.versionRepo.save(
      this.versionRepo.create({
        formId: form.id,
        version: 1,
        structure: this.buildStructure(
          pages,
          trimmed.logic,
          trimmed.scoreConfig,
        ),
      }),
    );

    const created = await this.get(form.id);
    // اگر چیزی به‌خاطر پلن کنار گذاشته شد، پنل باید بتواند بگوید چه چیزی.
    return trimmed.skipped.length
      ? { ...created, planSkipped: trimmed.skipped }
      : created;
  }

  async get(id: string) {
    const form = await this.formRepo.findOne({ where: { id } });
    if (!form) throw new NotFoundException('فرم یافت نشد');

    const latestVersion = await this.versionRepo.findOne({
      where: { formId: id },
      order: { version: 'DESC' },
    });
    const publication = await this.publicationRepo.findOne({
      where: { formId: id, type: PublicationType.LINK },
    });
    return { ...form, latestVersion, publication };
  }

  async analyzeLogic(id: string) {
    const latestVersion = await this.versionRepo.findOne({
      where: { formId: id },
      order: { version: 'DESC' },
    });
    if (!latestVersion) throw new NotFoundException('نسخه فرم یافت نشد');
    return this.logicEngine.analyzeStructure(latestVersion.structure);
  }

  /** نمای فلوچارت مسیر فرم برای ویرایشگر گرافیکی. */
  async flowGraph(id: string) {
    const latestVersion = await this.versionRepo.findOne({
      where: { formId: id },
      order: { version: 'DESC' },
    });
    if (!latestVersion) throw new NotFoundException('نسخه فرم یافت نشد');
    return this.logicEngine.buildFlowGraph(latestVersion.structure);
  }

  async update(id: string, dto: UpdateFormDto) {
    const form = await this.formRepo.findOne({ where: { id } });
    if (!form) throw new NotFoundException('فرم یافت نشد');

    if (dto.settings) {
      await this.assertStructurePlan(form.workspaceId, {
        settings: dto.settings,
      });
    }

    form.title = dto.title ?? form.title;
    form.status = dto.status ?? form.status;
    form.settings = dto.settings ?? form.settings;
    await this.formRepo.save(form);

    if (dto.questions || dto.pages || dto.logic || dto.scoreConfig) {
      const latest = await this.versionRepo.findOne({
        where: { formId: id },
        order: { version: 'DESC' },
      });
      const existing = latest?.structure ?? {};
      const existingPages = (existing.pages as FormPageDto[] | undefined) ?? [];
      const nextPages =
        dto.pages || dto.questions
          ? this.resolvePages(dto.pages, dto.questions)
          : existingPages;
      await this.validatePages(nextPages, form.workspaceId);
      this.validateLogic(
        dto.logic ?? (existing.logic as Record<string, unknown> | undefined),
        nextPages,
      );
      await this.assertStructurePlan(form.workspaceId, {
        logic: dto.logic ?? (existing.logic as Record<string, unknown>),
        scoreConfig:
          dto.scoreConfig ?? (existing.scoreConfig as Record<string, unknown>),
        settings: form.settings,
      });
      await this.versionRepo.save(
        this.versionRepo.create({
          formId: id,
          version: (latest?.version ?? 0) + 1,
          structure: this.buildStructure(
            nextPages,
            dto.logic ??
              (existing.logic as Record<string, unknown> | undefined),
            dto.scoreConfig ??
              (existing.scoreConfig as Record<string, unknown> | undefined),
          ),
        }),
      );
    }

    return this.get(id);
  }

  async publishLink(formId: string) {
    const form = await this.formRepo.findOne({ where: { id: formId } });
    if (!form) throw new NotFoundException('فرم یافت نشد');

    if (form.status !== FormStatus.ACTIVE) {
      await this.formRepo.update(formId, { status: FormStatus.ACTIVE });
    }

    let publication = await this.publicationRepo.findOne({
      where: { formId, type: PublicationType.LINK },
    });
    if (!publication) {
      publication = await this.publicationRepo.save(
        this.publicationRepo.create({
          formId,
          type: PublicationType.LINK,
          token: randomBytes(16).toString('hex'),
        }),
      );
    }

    return publication;
  }

  /**
   * تعیین یا تغییر لینک اختصاصی فرم.
   *
   * توکن تصادفی همچنان معتبر می‌ماند تا لینک‌های پخش‌شده‌ی قبلی نشکنند؛
   * نشانی اختصاصی یک راه ورود اضافه است، نه جایگزین.
   */
  async setPublicationSlug(formId: string, requestedSlug: string) {
    const publication = await this.publicationRepo.findOne({
      where: { formId, type: PublicationType.LINK },
    });
    if (!publication) {
      throw new NotFoundException(
        'ابتدا لینک فرم را منتشر کنید سپس نشانی اختصاصی بگذارید',
      );
    }

    const validation = validateSlug(requestedSlug);
    if (!validation.valid) {
      throw new BadRequestException(validation.reason ?? 'نشانی نامعتبر است');
    }

    const taken = await this.publicationRepo.findOne({
      where: { slug: validation.normalized },
    });
    if (taken && taken.id !== publication.id) {
      throw new BadRequestException('این نشانی قبلا استفاده شده است');
    }

    publication.slug = validation.normalized;
    return this.publicationRepo.save(publication);
  }

  /** آیا این نشانی آزاد است؟ برای بررسی زنده هنگام تایپ در پنل. */
  async isSlugAvailable(requestedSlug: string) {
    const validation = validateSlug(requestedSlug);
    if (!validation.valid) {
      return { available: false, reason: validation.reason };
    }

    const taken = await this.publicationRepo.findOne({
      where: { slug: validation.normalized },
    });
    return taken
      ? { available: false, reason: 'این نشانی قبلا استفاده شده است' }
      : { available: true, reason: null, slug: validation.normalized };
  }

  /**
   * تعیین نحوه‌ی احراز هویت پاسخ‌دهنده روی لینک اصلی فرم.
   * رمز عبور هش‌شده ذخیره می‌شود و هرگز به کلاینت برنمی‌گردد.
   */
  async setAuthMode(
    formId: string,
    authMode: PublicationAuthMode,
    password?: string,
  ) {
    const publication = await this.publicationRepo.findOne({
      where: { formId, type: PublicationType.LINK },
    });
    if (!publication) {
      throw new NotFoundException('ابتدا لینک فرم را منتشر کنید');
    }

    if (authMode === PublicationAuthMode.PASSWORD) {
      const config = publication.config as { passwordHash?: string };
      if (!password && !config.passwordHash) {
        throw new BadRequestException('برای حالت رمز عبور باید رمز تعیین کنید');
      }
      if (password) {
        if (password.length < 4) {
          throw new BadRequestException('رمز باید حداقل ۴ نویسه باشد');
        }
        publication.config = {
          ...publication.config,
          passwordHash: await bcrypt.hash(password, 10),
        };
      }
    }

    if (authMode !== PublicationAuthMode.PASSWORD) {
      // رمز قدیمی نباید بعد از تغییر حالت باقی بماند.
      const config = { ...publication.config };
      delete config.passwordHash;
      publication.config = config;
    }

    publication.authMode = authMode;
    const saved = await this.publicationRepo.save(publication);

    return {
      id: saved.id,
      authMode: saved.authMode,
      hasPassword: Boolean(
        (saved.config as { passwordHash?: string }).passwordHash,
      ),
    };
  }

  async createPublication(formId: string, dto: CreatePublicationDto) {
    const form = await this.formRepo.findOne({ where: { id: formId } });
    if (!form) throw new NotFoundException('فرم یافت نشد');

    const publication = await this.publicationRepo.save(
      this.publicationRepo.create({
        formId,
        type: dto.type,
        authMode: dto.authMode ?? PublicationAuthMode.NONE,
        token: randomBytes(16).toString('hex'),
        tags: dto.tags ?? [],
        config: dto.config ?? {},
        isActive: true,
      }),
    );
    return publication;
  }

  private validateQuestions(questions: FormQuestionDto[]) {
    const invalid = questions.find(
      (q) => !(ALL_QUESTION_TYPES as readonly string[]).includes(q.type),
    );
    if (invalid)
      throw new BadRequestException('نوع سوال خارج از محدوده سامانه است');
  }

  private async validatePages(pages: FormPageDto[], workspaceId: string) {
    pages.forEach((page) => this.validateQuestions(page.questions ?? []));

    const usedTypes = new Set<string>();
    pages.forEach((page) =>
      (page.questions ?? []).forEach((question) =>
        usedTypes.add(question.type),
      ),
    );

    const policy = (await this.planService.getWorkspacePolicy(workspaceId)) as {
      maxQuestionTypes?: number;
    } | null;
    const maxQuestionTypes = Number(policy?.maxQuestionTypes ?? -1);
    if (maxQuestionTypes >= 0 && usedTypes.size > maxQuestionTypes) {
      throw new BadRequestException(
        `تعداد نوع سوال استفاده‌شده از سقف پلن (${maxQuestionTypes}) بیشتر است`,
      );
    }
  }

  private resolvePages(
    pages?: FormPageDto[],
    questions?: FormQuestionDto[],
  ): FormPageDto[] {
    if (pages?.length) {
      return pages;
    }

    if (questions?.length) {
      return [{ id: 'page_1', title: 'صفحه ۱', questions }];
    }

    throw new BadRequestException('حداقل یک صفحه یا سوال لازم است');
  }

  /**
   * امکانات پلن در خودِ ساختار فرم: منطق شرطی، منطق پرش، شاخص و چندزبانه.
   *
   * تا پیش از این جدول پلن فقط نمایشی بود و پلن رایگان هم همه‌ی این‌ها را
   * داشت. بررسی سر ذخیره انجام می‌شود، نه سر نمایش، تا از راه API هم دور
   * زده نشود.
   */
  private async assertStructurePlan(
    workspaceId: string,
    input: {
      logic?: Record<string, unknown>;
      scoreConfig?: Record<string, unknown>;
      settings?: Record<string, unknown>;
    },
  ) {
    const organizationId =
      await this.planService.organizationOfWorkspace(workspaceId);
    if (!organizationId) return;

    const logic = input.logic ?? {};
    if (asArray(logic.display).length) {
      await this.planService.assertFeature(organizationId, 'logicDisplay');
    }
    if (asArray(logic.skip).length) {
      await this.planService.assertFeature(organizationId, 'logicSkip');
    }

    const indices = asArray(input.scoreConfig?.indices);
    if (indices.length) {
      // سقف شمارشی است: هر شاخص یک «جا» از سهم پلن می‌گیرد.
      await this.planService.assertQuota(
        organizationId,
        'indices',
        indices.length - 1,
      );
    }

    if (asArray(input.settings?.languages).length > 1) {
      await this.planService.assertFeature(organizationId, 'multiLanguage');
    }
  }

  /**
   * بخش‌هایی از قالب آماده که پلن سازمان ندارد، کنار گذاشته می‌شوند.
   *
   * قالب‌ها منطق شرطی و شاخص دارند و پلن رایگان هیچ‌کدام را ندارد. اگر
   * ساختِ قالب رد می‌شد، کتابخانه‌ی قالب در پلن رایگان بی‌استفاده می‌ماند؛
   * پس سوال‌ها می‌مانند و فقط چیزی که پلن اجازه نمی‌دهد حذف می‌شود و در
   * پاسخ گفته می‌شود چه چیزی کنار گذاشته شد.
   */
  private async trimTemplateToPlan(
    workspaceId: string,
    draft: {
      logic?: Record<string, unknown>;
      scoreConfig?: Record<string, unknown>;
      settings?: Record<string, unknown>;
    },
  ): Promise<{
    logic?: Record<string, unknown>;
    scoreConfig?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    skipped: string[];
  }> {
    const organizationId =
      await this.planService.organizationOfWorkspace(workspaceId);
    if (!organizationId) return { ...draft, skipped: [] };

    const limits =
      await this.planService.getPolicyByOrganization(organizationId);
    const skipped: string[] = [];

    const logic = { ...(draft.logic ?? {}) };
    if (limits.logicDisplay !== true && asArray(logic.display).length) {
      delete logic.display;
      skipped.push('منطق شرطی نمایش');
    }
    if (limits.logicSkip !== true && asArray(logic.skip).length) {
      delete logic.skip;
      skipped.push('منطق پرش');
    }

    let scoreConfig = draft.scoreConfig;
    const indices = asArray(scoreConfig?.indices);
    const maxIndices = Number(limits.indices ?? 0);
    if (indices.length && maxIndices !== -1 && indices.length > maxIndices) {
      scoreConfig =
        maxIndices > 0
          ? { ...scoreConfig, indices: indices.slice(0, maxIndices) }
          : undefined;
      skipped.push(
        maxIndices > 0
          ? `شاخص‌های بیش از ${maxIndices.toLocaleString('fa-IR')} تا`
          : 'شاخص و وزن‌دهی',
      );
    }

    let settings = draft.settings;
    if (
      limits.multiLanguage !== true &&
      asArray(settings?.languages).length > 1
    ) {
      settings = { ...settings, languages: ['fa'] };
      skipped.push('چندزبانه');
    }

    return {
      logic: Object.keys(logic).length ? logic : undefined,
      scoreConfig,
      settings,
      skipped,
    };
  }

  private validateLogic(
    logic: Record<string, unknown> | undefined,
    pages: FormPageDto[],
  ) {
    if (!logic) return;
    // DTOها شکل بازتری از نوع‌های ساختار دارند؛ تبدیل امن است چون
    // analyzeStructure فقط شناسه‌ها را می‌خواند.
    const analysis = this.logicEngine.analyzeStructure({
      pages,
      logic,
    } as unknown as FormStructure);
    if (!analysis.isValid) {
      throw new BadRequestException(analysis.errors.join(' | '));
    }
  }

  private buildStructure(
    pages: FormPageDto[],
    logic?: Record<string, unknown>,
    scoreConfig?: Record<string, unknown>,
  ) {
    const scoreIndexes = Array.isArray(scoreConfig?.indices)
      ? scoreConfig.indices
      : [];

    return {
      pages,
      logic: logic ?? { display: [], skip: [], pipe: [] },
      scoreConfig: scoreConfig ?? { indices: [] },
      scoreIndexes,
    };
  }
}
