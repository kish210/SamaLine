import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { FormEntity } from '../database/entities/form.entity';
import { ResponseCommentEntity } from '../database/entities/response-comment.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { CreateResponseCommentDto, ResponseFilterDto } from './dto';
import { LIKE_OPERATOR } from '../database/column-types';
import { StaffNotifyService } from '../integrations/staff-notify.service';
import { AuditService } from '../common/audit.service';

@Injectable()
export class ResponseService {
  constructor(
    @InjectRepository(ResponseEntity)
    private readonly responseRepo: Repository<ResponseEntity>,
    @InjectRepository(FormEntity)
    private readonly formRepo: Repository<FormEntity>,
    @InjectRepository(ResponseCommentEntity)
    private readonly commentRepo: Repository<ResponseCommentEntity>,
    private readonly staffNotify: StaffNotifyService,
    // اختیاری تا تست‌هایی که سرویس را دستی می‌سازند نشکنند؛ در اجرا تزریق می‌شود.
    @Optional() private readonly audit?: AuditService,
  ) {}

  /** شناسه‌ی فرمِ یک پاسخ؛ برای بررسی مالکیت. */
  async formIdOf(responseId: string): Promise<string | null> {
    const row = await this.responseRepo.findOne({
      where: { id: responseId },
      relations: { formVersion: true },
    });
    return row?.formVersion?.formId ?? null;
  }

  async listByForm(formId: string, filter?: ResponseFilterDto) {
    const qb = this.responseRepo
      .createQueryBuilder('response')
      .innerJoin('response.formVersion', 'formVersion')
      .where('formVersion.formId = :formId', { formId });

    if (filter?.status) {
      qb.andWhere('response.status = :status', { status: filter.status });
    }

    if (filter?.respondentKey) {
      qb.andWhere('response.respondentKey = :respondentKey', {
        respondentKey: filter.respondentKey,
      });
    }

    if (filter?.dateFrom) {
      qb.andWhere('response.createdAt >= :dateFrom', {
        dateFrom: filter.dateFrom,
      });
    }

    if (filter?.dateTo) {
      qb.andWhere('response.createdAt <= :dateTo', { dateTo: filter.dateTo });
    }

    if (filter?.questionId || filter?.valueText) {
      qb.innerJoin('response.answerFlat', 'answerFlat');
      if (filter.questionId) {
        qb.andWhere('answerFlat.questionId = :questionId', {
          questionId: filter.questionId,
        });
      }
      if (filter.valueText) {
        qb.andWhere(`answerFlat.valueText ${LIKE_OPERATOR} :valueText`, {
          valueText: `%${filter.valueText}%`,
        });
      }
    }

    return qb.orderBy('response.createdAt', 'DESC').take(500).getMany();
  }

  /**
   * درخواست‌های در انتظارِ تأیید در یک فضای کاری — کارتابلِ مدیر (فاز H).
   *
   * فقط فرم‌های `requiresApproval` که مدیر به بخششان دسترسی دارد بررسی می‌شوند.
   * وضعیتِ بررسی داخلِ `meta.review` (JSON) است و فیلترِ آن بین SQLite/Postgres
   * فرق دارد، پس پاسخ‌های کاملِ همان فرم‌ها خوانده و در حافظه فیلتر می‌شوند؛ چون
   * فقط فرم‌های نیازمندِ تأیید را می‌خوانیم، دامنه کوچک می‌ماند.
   */
  async pendingReviews(
    workspaceId: string,
    scope: { isManager: boolean; departmentIds: string[] },
  ) {
    const { rows, titleById } = await this.findPending(workspaceId, scope);
    return rows.map((row) => {
      const review = row.meta?.review as Record<string, unknown>;
      const formId = row.formVersion?.formId ?? '';
      return {
        responseId: row.id,
        formId,
        formTitle: titleById.get(formId) ?? 'فرم',
        respondentKey: row.respondentKey,
        submittedAt: row.submittedAt,
        requestedAt: (review?.requestedAt as string) ?? null,
        answers: row.answers,
      };
    });
  }

  /** فقط شمارِ درخواست‌های معلق — برای نشانِ منو (فاز H). */
  async pendingReviewCount(
    workspaceId: string,
    scope: { isManager: boolean; departmentIds: string[] },
  ) {
    const { rows } = await this.findPending(workspaceId, scope);
    return { count: rows.length };
  }

  /** فرم‌های نیازمندِ تأییدِ قابل‌دسترسِ مدیر و پاسخ‌های معلقِ آن‌ها. */
  private async findPending(
    workspaceId: string,
    scope: { isManager: boolean; departmentIds: string[] },
  ) {
    /*
     * فرم‌های نیازمندِ تأیید یا دارای گردش‌کار. دسترسیِ بخش این‌جا سطحِ فرم
     * بررسی نمی‌شود چون در گردش‌کار، بخشِ مسئولِ هر پاسخ بسته به مرحله‌ی جاری
     * فرق می‌کند (review.departmentId)، نه بخشِ خودِ فرم. پس فیلترِ بخش per-پاسخ
     * اعمال می‌شود.
     */
    const forms = (await this.formRepo.find({ where: { workspaceId } })).filter(
      (form) => {
        const s = form.settings as Record<string, unknown> | undefined;
        return Boolean(s?.requiresApproval) || hasWorkflow(s);
      },
    );
    if (forms.length === 0) {
      return { rows: [] as ResponseEntity[], titleById: new Map<string, string>() };
    }

    const formById = new Map(forms.map((form) => [form.id, form]));
    const titleById = new Map(forms.map((form) => [form.id, form.title]));
    const all = await this.responseRepo
      .createQueryBuilder('response')
      .leftJoinAndSelect('response.formVersion', 'formVersion')
      .where('formVersion.formId IN (:...ids)', {
        ids: forms.map((form) => form.id),
      })
      .andWhere('response.status = :status', { status: 'completed' })
      .orderBy('response.createdAt', 'DESC')
      .take(1000)
      .getMany();

    const rows = all.filter((row) => {
      const review = row.meta?.review as Record<string, unknown> | undefined;
      if (review?.status !== 'pending') return false;
      if (scope.isManager) return true;
      // بخشِ مسئولِ این پاسخ: در گردش‌کار بخشِ مرحله‌ی جاری، وگرنه بخشِ فرم.
      const form = formById.get(row.formVersion?.formId ?? '');
      const responsibleDept =
        (review?.departmentId as string | undefined) ?? form?.departmentId ?? null;
      return !responsibleDept || scope.departmentIds.includes(responsibleDept);
    });
    return { rows, titleById };
  }

  async exportByForm(formId: string) {
    const form = await this.formRepo.findOne({ where: { id: formId } });
    const responses = await this.listByForm(formId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('responses');
    sheet.columns = [
      { header: 'response_id', key: 'id', width: 38 },
      { header: 'status', key: 'status', width: 14 },
      { header: 'respondent_key', key: 'respondentKey', width: 24 },
      { header: 'submitted_at', key: 'submittedAt', width: 26 },
      { header: 'answers_json', key: 'answers', width: 80 },
    ];

    responses.forEach((item) => {
      sheet.addRow({
        id: item.id,
        status: item.status,
        respondentKey: item.respondentKey ?? '',
        submittedAt: item.submittedAt?.toISOString() ?? '',
        answers: JSON.stringify(item.answers),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      filename: `${(form?.slug ?? formId).replace(/[^a-zA-Z0-9_-]/g, '-')}-responses.xlsx`,
      buffer: Buffer.from(buffer),
    };
  }

  getComments(responseId: string) {
    return this.commentRepo.find({
      where: { responseId },
      order: { createdAt: 'DESC' },
    });
  }

  async addComment(responseId: string, dto: CreateResponseCommentDto) {
    const response = await this.responseRepo.findOne({
      where: { id: responseId },
    });
    if (!response) {
      throw new NotFoundException('پاسخ مورد نظر یافت نشد');
    }

    return this.commentRepo.save(
      this.commentRepo.create({
        responseId,
        authorName: dto.authorName,
        body: dto.body,
      }),
    );
  }

  /**
   * بررسیِ یک درخواست (تأیید/رد) در گردش‌کارِ HR — فاز E.
   *
   * وضعیتِ بررسی در `meta.review` می‌نشیند (JSON است، پس نه ستونِ تازه می‌خواهد
   * نه مهاجرت). پاسخ‌دهنده بعدا همین وضعیت را در پورتالِ خودش می‌بیند.
   */
  async review(
    responseId: string,
    decision: 'approved' | 'rejected',
    note: string | undefined,
    reviewer: {
      userId: string;
      email: string;
      organizationId: string;
      scope: { isManager: boolean; departmentIds: string[] };
    },
  ) {
    const response = await this.responseRepo.findOne({
      where: { id: responseId },
      // برای اعلانِ پرسنل، سازمان/فضا و عنوانِ فرم را هم لازم داریم.
      relations: { formVersion: { form: { workspace: true } } },
    });
    if (!response) {
      throw new NotFoundException('پاسخ مورد نظر یافت نشد');
    }

    const form = response.formVersion?.form;
    const previous = (response.meta?.review ?? {}) as ResponseReview;
    const steps = workflowSteps(form?.settings as Record<string, unknown> | undefined);
    const inWorkflow = steps.length > 0 && typeof previous.step === 'number';

    /*
     * مجوزدهیِ متمرکز (چون این مسیر assertResponse را دور می‌زند تا گردش‌کارِ
     * بین‌واحدی ممکن شود): اول مالکیتِ سازمان، بعد بخش.
     */
    if (!form) throw new NotFoundException('فرم این پاسخ یافت نشد');
    if (form.workspace?.organizationId !== reviewer.organizationId) {
      throw new ForbiddenException('به این پاسخ دسترسی ندارید');
    }
    if (!reviewer.scope.isManager) {
      // در گردش‌کار: بخشِ مرحله‌ی جاری؛ وگرنه: بخشِ فرم.
      const requiredDept = inWorkflow
        ? (previous.departmentId ?? null)
        : (form.departmentId ?? null);
      if (requiredDept && !reviewer.scope.departmentIds.includes(requiredDept)) {
        throw new ForbiddenException(
          inWorkflow
            ? 'این مرحله‌ی گردش‌کار برای واحدِ شما نیست'
            : 'این فرم متعلق به بخشی است که عضو آن نیستید',
        );
      }
    }

    const now = new Date().toISOString();
    const historyEntry = {
      step: previous.step ?? 0,
      departmentId: previous.departmentId ?? null,
      decision,
      byEmail: reviewer.email,
      at: now,
      note: note ?? '',
    };
    const history = [...(previous.history ?? []), historyEntry];

    let review: ResponseReview;
    let advancedTo: { departmentId: string | null } | null = null;
    if (inWorkflow && decision === 'approved' && (previous.step ?? 0) < steps.length - 1) {
      // به مرحله‌ی بعد برو؛ همچنان «در انتظار» ولی مسئولش بخشِ مرحله‌ی بعد است.
      const nextStep = (previous.step ?? 0) + 1;
      review = {
        ...previous,
        status: 'pending',
        step: nextStep,
        departmentId: steps[nextStep]?.departmentId ?? null,
        byUserId: reviewer.userId,
        byEmail: reviewer.email,
        at: now,
        note: note ?? '',
        history,
      };
      advancedTo = { departmentId: steps[nextStep]?.departmentId ?? null };
    } else {
      // تصمیمِ نهایی (رد، یا تأییدِ آخرین مرحله / فرمِ بدونِ گردش‌کار).
      review = {
        ...previous,
        status: decision,
        byUserId: reviewer.userId,
        byEmail: reviewer.email,
        at: now,
        note: note ?? '',
        ...(inWorkflow ? { history } : {}),
      };
    }

    response.meta = { ...(response.meta ?? {}), review };
    const saved = await this.responseRepo.save(response);

    // اعلان به رباتِ پرسنل؛ خودش هرگز خطا نمی‌دهد و مسیرِ تأیید را نگه نمی‌دارد.
    // فقط تصمیمِ نهایی به پاسخ‌دهنده اعلام می‌شود (نه پیشرویِ میان‌مرحله‌ای).
    if (form && !advancedTo) {
      await this.staffNotify.notifyReviewDecision({
        organizationId: form.workspace.organizationId,
        workspaceId: form.workspaceId,
        respondentKey: response.respondentKey,
        formTitle: form.title,
        decision,
        note,
      });
    }

    // ثبتِ ممیزی: چه کسی کدام درخواست را تأیید/رد یا به مرحله‌ی بعد برد.
    await this.audit?.log({
      organizationId: form.workspace.organizationId,
      action: advancedTo ? 'response.workflow_advanced' : `response.${decision}`,
      actorType: 'user',
      actorId: reviewer.userId,
      payload: {
        responseId,
        formId: form.id,
        formTitle: form.title,
        step: previous.step ?? null,
        note: note ?? '',
      },
    });

    return saved;
  }
}

/** مراحلِ گردش‌کارِ یک فرم از تنظیماتش (خالی اگر گردش‌کار ندارد). */
function workflowSteps(
  settings: Record<string, unknown> | undefined,
): Array<{ departmentId?: string; label?: string }> {
  const steps = (settings?.workflow as { steps?: unknown } | undefined)?.steps;
  return Array.isArray(steps) ? (steps as Array<{ departmentId?: string; label?: string }>) : [];
}

function hasWorkflow(settings: Record<string, unknown> | undefined): boolean {
  return workflowSteps(settings).length > 0;
}

/** وضعیتِ بررسیِ یک درخواست، ذخیره‌شده داخلِ `response.meta.review`. */
export interface ResponseReview {
  status: 'pending' | 'approved' | 'rejected';
  byUserId?: string;
  byEmail?: string;
  at?: string;
  note?: string;
  /** زمانِ ثبتِ درخواست توسطِ پرسنل (هنگامِ ارسالِ فرم تنظیم می‌شود). */
  requestedAt?: string;
  /** گردش‌کار (#3): شماره‌ی مرحله‌ی جاری (۰-مبنا)، شمارِ کل، بخشِ مسئولِ مرحله، و تاریخچه. */
  step?: number;
  stepCount?: number;
  departmentId?: string | null;
  history?: Array<{
    step: number;
    departmentId: string | null;
    decision: 'approved' | 'rejected';
    byEmail: string;
    at: string;
    note: string;
  }>;
}
