import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { FormEntity } from '../database/entities/form.entity';
import { ResponseCommentEntity } from '../database/entities/response-comment.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { CreateResponseCommentDto, ResponseFilterDto } from './dto';
import { LIKE_OPERATOR } from '../database/column-types';
import { StaffNotifyService } from '../integrations/staff-notify.service';

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
    const forms = (await this.formRepo.find({ where: { workspaceId } })).filter(
      (form) =>
        Boolean(
          (form.settings as Record<string, unknown> | undefined)
            ?.requiresApproval,
        ) &&
        (scope.isManager ||
          !form.departmentId ||
          scope.departmentIds.includes(form.departmentId)),
    );
    if (forms.length === 0) {
      return { rows: [] as ResponseEntity[], titleById: new Map<string, string>() };
    }

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

    const rows = all.filter(
      (row) =>
        (row.meta?.review as Record<string, unknown> | undefined)?.status ===
        'pending',
    );
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
    reviewer: { userId: string; email: string },
  ) {
    const response = await this.responseRepo.findOne({
      where: { id: responseId },
      // برای اعلانِ پرسنل، سازمان/فضا و عنوانِ فرم را هم لازم داریم.
      relations: { formVersion: { form: { workspace: true } } },
    });
    if (!response) {
      throw new NotFoundException('پاسخ مورد نظر یافت نشد');
    }

    const previous = (response.meta?.review ?? {}) as Record<string, unknown>;
    const review: ResponseReview = {
      ...previous,
      status: decision,
      byUserId: reviewer.userId,
      byEmail: reviewer.email,
      at: new Date().toISOString(),
      note: note ?? '',
    };
    response.meta = { ...(response.meta ?? {}), review };
    const saved = await this.responseRepo.save(response);

    // اعلان به رباتِ پرسنل؛ خودش هرگز خطا نمی‌دهد و مسیرِ تأیید را نگه نمی‌دارد.
    const form = response.formVersion?.form;
    if (form) {
      await this.staffNotify.notifyReviewDecision({
        organizationId: form.workspace.organizationId,
        workspaceId: form.workspaceId,
        respondentKey: response.respondentKey,
        formTitle: form.title,
        decision,
        note,
      });
    }

    return saved;
  }
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
}
