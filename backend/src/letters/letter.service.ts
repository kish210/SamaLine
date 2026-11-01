import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, IsNull, Repository } from 'typeorm';
import {
  LetterAttachment,
  LetterEntity,
  LetterPriority,
  LetterRecipientEntity,
  LetterRecipientKind,
} from '../database/entities/letter.entity';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { AuditService } from '../common/audit.service';
import { LIKE_OPERATOR } from '../database/column-types';

const MAX_PAGE_SIZE = 100;
/** بیش از این تعداد گیرنده یعنی اطلاعیه، نه نامه. */
const MAX_RECIPIENTS = 50;

export interface SendLetterInput {
  subject: string;
  body?: string;
  /** گیرنده‌های اصلی. */
  to: string[];
  /** رونوشت. */
  cc?: string[];
  priority?: LetterPriority;
  attachments?: LetterAttachment[];
  /** پاسخ به این نامه. */
  parentLetterId?: string | null;
}

export interface LetterListQuery {
  /** فقط نخوانده‌ها. */
  unread?: boolean | string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const isTrue = (v: unknown) => v === true || v === 'true';

/**
 * نامهٔ داخلیِ سازمان.
 *
 * نامه سندِ ارتباط است، نه پیامِ گپ: شماره می‌گیرد، حذف نمی‌شود، و پاسخ‌ها
 * رشته می‌سازند. سه قاعده‌ی محوری:
 *
 * ۱. **فقط فرستنده و گیرنده‌ها نامه را می‌بینند** — هم‌سازمان بودن کافی
 *    نیست؛ وگرنه نامهٔ شخصیِ دو نفر برای کلِ هتل خواندنی می‌شد.
 * ۲. **وضعیتِ خوانده‌شدن به‌ازای هر گیرنده است** — خواندنِ یک نفر نامه را
 *    برای بقیه خوانده‌شده نمی‌کند.
 * ۳. **نامه حذف نمی‌شود** — هیچ مسیرِ حذفی وجود ندارد، چون سندِ سازمانی
 *    است و پاک شدنش یعنی از بین رفتنِ تاریخچهٔ تصمیم.
 */
@Injectable()
export class LetterService {
  constructor(
    @InjectRepository(LetterEntity)
    private readonly letters: Repository<LetterEntity>,
    @InjectRepository(LetterRecipientEntity)
    private readonly recipients: Repository<LetterRecipientEntity>,
    @InjectRepository(PersonnelEntity)
    private readonly people: Repository<PersonnelEntity>,
    private readonly dataSource: DataSource,
    @Optional() private readonly audit?: AuditService,
  ) {}

  /**
   * ارسالِ نامه.
   *
   * نامه و گیرنده‌هایش در یک تراکنش نوشته می‌شوند: نامهٔ بی‌گیرنده سندی است
   * که هیچ‌کس نمی‌بیند و هیچ‌کس هم نمی‌تواند پاکش کند.
   */
  async send(
    organizationId: string,
    senderPersonnelId: string,
    input: SendLetterInput,
    senderUserId?: string,
  ) {
    const subject = (input.subject ?? '').trim();
    if (!subject) throw new BadRequestException('موضوعِ نامه لازم است');

    const sender = await this.people.findOne({
      where: { id: senderPersonnelId, organizationId },
    });
    if (!sender) throw new NotFoundException('پروندهٔ فرستنده یافت نشد');

    const to = [...new Set((input.to ?? []).filter(Boolean))];
    const cc = [...new Set((input.cc ?? []).filter(Boolean))].filter(
      (id) => !to.includes(id),
    );
    if (to.length === 0) {
      throw new BadRequestException('دست‌کم یک گیرنده لازم است');
    }
    if (to.length + cc.length > MAX_RECIPIENTS) {
      throw new BadRequestException(
        `بیش از ${MAX_RECIPIENTS} گیرنده یعنی اطلاعیه، نه نامه؛ از «اطلاعیه‌ها» استفاده کنید`,
      );
    }

    // هر گیرنده باید پرسنلِ فعالِ همین سازمان باشد.
    const all = [...to, ...cc];
    const found = await this.people.find({
      where: { id: In(all), organizationId, isActive: true },
      select: { id: true },
    });
    if (found.length !== all.length) {
      throw new BadRequestException(
        'برخی گیرنده‌ها پرسنلِ فعالِ این سازمان نیستند',
      );
    }

    /*
     * پاسخ: والد باید نامه‌ای باشد که خودِ فرستنده حقِ دیدنش را دارد.
     *
     * بدونِ این بررسی می‌شد با حدس زدنِ شناسه، خود را به رشتهٔ مکاتبهٔ
     * دیگران چسباند و از آن پس همهٔ پاسخ‌ها را گرفت.
     */
    let parent: LetterEntity | null = null;
    if (input.parentLetterId) {
      parent = await this.requireVisible(
        organizationId,
        input.parentLetterId,
        senderPersonnelId,
      );
    }

    const number = await this.nextNumber(organizationId);

    const saved = await this.dataSource.transaction(async (manager) => {
      const letter = await manager.save(
        manager.create(LetterEntity, {
          organizationId,
          number,
          subject,
          body: input.body ?? '',
          senderPersonnelId,
          senderUserId: senderUserId ?? null,
          departmentId: sender.departmentId,
          priority: input.priority ?? LetterPriority.NORMAL,
          parentLetterId: parent?.id ?? null,
          // سرِ رشته: نامهٔ اول خودش ریشه است.
          threadId: parent?.threadId ?? '',
          attachments: input.attachments ?? [],
        } as Partial<LetterEntity>),
      );
      if (!letter.threadId) {
        letter.threadId = letter.id;
        await manager.save(letter);
      }

      for (const [kind, ids] of [
        [LetterRecipientKind.TO, to],
        [LetterRecipientKind.CC, cc],
      ] as const) {
        for (const personnelId of ids) {
          await manager.save(
            manager.create(LetterRecipientEntity, {
              organizationId,
              letterId: letter.id,
              personnelId,
              kind,
            }),
          );
        }
      }

      /*
       * پاسخ دادن، «پاسخ داده شد» را روی سطرِ خودِ پاسخ‌دهنده می‌گذارد و
       * نامه را برایش خوانده‌شده می‌کند — کسی که جواب داده، قطعاً خوانده.
       */
      if (parent) {
        await manager.update(
          LetterRecipientEntity,
          { letterId: parent.id, personnelId: senderPersonnelId },
          { repliedAt: new Date(), readAt: new Date() },
        );
      }

      return letter;
    });

    this.log(senderUserId, organizationId, 'letter.send', saved.id, {
      number,
      recipients: all.length,
      isReply: Boolean(parent),
    });
    return saved;
  }

  /**
   * پاسخ به یک نامه.
   *
   * فرستندهٔ نامهٔ اصلی خودکار گیرنده می‌شود و بقیهٔ گیرنده‌ها رونوشت
   * می‌گیرند، تا مکاتبه از وسط دو نیم نشود و کسی که در جریان بود بیرون
   * نیفتد. خودِ پاسخ‌دهنده گیرندهٔ نامهٔ خودش نمی‌شود.
   */
  async reply(
    organizationId: string,
    personnelId: string,
    letterId: string,
    input: { body: string; subject?: string; attachments?: LetterAttachment[] },
    userId?: string,
  ) {
    const parent = await this.requireVisible(
      organizationId,
      letterId,
      personnelId,
    );
    const others = await this.recipients.find({
      where: { letterId: parent.id },
      select: { personnelId: true },
    });

    const cc = [...new Set(others.map((r) => r.personnelId))].filter(
      (id) => id !== personnelId && id !== parent.senderPersonnelId,
    );
    const to = [parent.senderPersonnelId].filter((id) => id !== personnelId);
    /*
     * پاسخ به نامهٔ خودم (مثلاً پیگیری): گیرنده‌ها همان گیرنده‌های قبلی‌اند.
     * وگرنه «دست‌کم یک گیرنده» رد می‌شد و پیگیری ناممکن می‌ماند.
     */
    const finalTo = to.length > 0 ? to : cc;
    const finalCc = to.length > 0 ? cc : [];

    return this.send(
      organizationId,
      personnelId,
      {
        subject: input.subject?.trim() || `پاسخ: ${parent.subject}`,
        body: input.body,
        to: finalTo,
        cc: finalCc,
        attachments: input.attachments,
        parentLetterId: parent.id,
        priority: parent.priority,
      },
      userId,
    );
  }

  /** صندوقِ دریافت. */
  async inbox(
    organizationId: string,
    personnelId: string,
    query: LetterListQuery = {},
  ) {
    const qb = this.letters
      .createQueryBuilder('l')
      .innerJoin(
        LetterRecipientEntity,
        'r',
        'r.letterId = l.id AND r.personnelId = :me',
        { me: personnelId },
      )
      .addSelect('r.readAt', 'r_readAt')
      .addSelect('r.kind', 'r_kind')
      .where('l.organizationId = :org', { org: organizationId });

    if (isTrue(query.unread)) qb.andWhere('r.readAt IS NULL');
    this.applySearch(qb, query.search);

    const page = await this.paginate(qb, query);
    const rows = await this.decorate(page.rows, personnelId);
    return { ...page, rows };
  }

  /** نامه‌های فرستاده‌شده. */
  async outbox(
    organizationId: string,
    personnelId: string,
    query: LetterListQuery = {},
  ) {
    const qb = this.letters
      .createQueryBuilder('l')
      .where('l.organizationId = :org', { org: organizationId })
      .andWhere('l.senderPersonnelId = :me', { me: personnelId });
    this.applySearch(qb, query.search);

    const page = await this.paginate(qb, query);
    const rows = await this.decorate(page.rows, personnelId);
    return { ...page, rows };
  }

  /** شمارِ نامه‌های نخوانده؛ برای نشانِ منو و میزِ کار. */
  unreadCount(organizationId: string, personnelId: string) {
    return this.recipients.count({
      where: { organizationId, personnelId, readAt: IsNull() },
    });
  }

  /** یک نامه، با گیرنده‌ها و نام‌ها — فقط برای کسی که حقِ دیدن دارد. */
  async get(organizationId: string, letterId: string, personnelId: string) {
    const letter = await this.requireVisible(
      organizationId,
      letterId,
      personnelId,
    );
    const [decorated] = await this.decorate([letter], personnelId);
    return decorated;
  }

  /**
   * کلِ یک رشتهٔ مکاتبه، به ترتیبِ زمان.
   *
   * با `threadId` یک کوئریِ ایندکس‌خورده است. فقط نامه‌هایی از رشته
   * برمی‌گردند که این شخص حقِ دیدنشان را دارد: در یک رشتهٔ بلند ممکن است
   * کسی از وسط اضافه شده باشد و نباید پیامِ پیش از خودش را ببیند.
   */
  async thread(organizationId: string, letterId: string, personnelId: string) {
    const letter = await this.requireVisible(
      organizationId,
      letterId,
      personnelId,
    );
    const all = await this.letters.find({
      where: { organizationId, threadId: letter.threadId },
      order: { createdAt: 'ASC' },
    });

    const visibleIds = new Set(
      (
        await this.recipients.find({
          where: { letterId: In(all.map((l) => l.id)), personnelId },
          select: { letterId: true },
        })
      ).map((r) => r.letterId),
    );
    const mine = all.filter(
      (l) => l.senderPersonnelId === personnelId || visibleIds.has(l.id),
    );
    return this.decorate(mine, personnelId);
  }

  /** خواندنِ نامه را ثبت می‌کند؛ فقط روی سطرِ خودِ همین گیرنده. */
  async markRead(
    organizationId: string,
    letterId: string,
    personnelId: string,
  ) {
    const row = await this.recipients.findOne({
      where: { organizationId, letterId, personnelId },
    });
    if (!row) {
      // فرستنده گیرنده نیست؛ «خواندن» برایش معنا ندارد ولی خطا هم نیست.
      const letter = await this.letters.findOne({
        where: { id: letterId, organizationId },
      });
      if (letter?.senderPersonnelId === personnelId) {
        return { read: false, reason: 'sender' as const };
      }
      throw new ForbiddenException('این نامه برای شما نیست');
    }
    if (!row.readAt) {
      row.readAt = new Date();
      await this.recipients.save(row);
    }
    return { read: true, readAt: row.readAt };
  }

  // ── کمک‌ها ────────────────────────────────────────────────────────────

  /** نامه، فقط اگر این شخص فرستنده یا یکی از گیرنده‌ها باشد. */
  private async requireVisible(
    organizationId: string,
    letterId: string,
    personnelId: string,
  ) {
    const letter = await this.letters.findOne({
      where: { id: letterId, organizationId },
    });
    if (!letter) throw new NotFoundException('نامه یافت نشد');
    if (letter.senderPersonnelId === personnelId) return letter;

    const mine = await this.recipients.findOne({
      where: { letterId, personnelId },
      select: { id: true },
    });
    /*
     * هم‌سازمان بودن کافی نیست.
     *
     * «یافت نشد» برمی‌گردد نه «دسترسی ندارید»، تا وجود یا نبودِ یک نامه هم
     * لو نرود.
     */
    if (!mine) throw new NotFoundException('نامه یافت نشد');
    return letter;
  }

  /** نامِ فرستنده و گیرنده‌ها و وضعیتِ خوانده‌شدنِ خودم. */
  private async decorate(rows: LetterEntity[], personnelId: string) {
    if (rows.length === 0) return [];

    const letterIds = rows.map((l) => l.id);
    const recipients = await this.recipients.find({
      where: { letterId: In(letterIds) },
    });
    const ids = new Set<string>([
      ...rows.map((l) => l.senderPersonnelId),
      ...recipients.map((r) => r.personnelId),
    ]);
    const people = await this.people.find({
      where: { id: In([...ids]) },
      select: { id: true, fullName: true, position: true },
    });
    const nameOf = new Map(people.map((p) => [p.id, p.fullName]));

    const byLetter = new Map<string, LetterRecipientEntity[]>();
    for (const r of recipients) {
      byLetter.set(r.letterId, [...(byLetter.get(r.letterId) ?? []), r]);
    }

    return rows.map((letter) => {
      const mine = (byLetter.get(letter.id) ?? []).find(
        (r) => r.personnelId === personnelId,
      );
      return {
        ...letter,
        senderName: nameOf.get(letter.senderPersonnelId) ?? 'نامشخص',
        recipients: (byLetter.get(letter.id) ?? []).map((r) => ({
          personnelId: r.personnelId,
          name: nameOf.get(r.personnelId) ?? 'نامشخص',
          kind: r.kind,
          /** زمانِ خواندنِ بقیه هم دیده می‌شود؛ رسیدِ نامه است. */
          readAt: r.readAt,
        })),
        /** وضعیتِ خودِ من روی این نامه. */
        isMine: letter.senderPersonnelId === personnelId,
        readAt: mine?.readAt ?? null,
        isUnread: Boolean(mine) && !mine?.readAt,
      };
    });
  }

  private applySearch(
    qb: ReturnType<Repository<LetterEntity>['createQueryBuilder']>,
    search?: string,
  ) {
    if (!search) return;
    const like = `%${search}%`;
    qb.andWhere(
      new Brackets((w) =>
        w
          .where(`l.subject ${LIKE_OPERATOR} :like`, { like })
          .orWhere(`l.number ${LIKE_OPERATOR} :like`, { like })
          .orWhere(`l.body ${LIKE_OPERATOR} :like`, { like }),
      ),
    );
  }

  private async paginate(
    qb: ReturnType<Repository<LetterEntity>['createQueryBuilder']>,
    query: LetterListQuery,
  ) {
    const pageSize = Math.min(
      Math.max(Number(query.pageSize ?? 20), 1),
      MAX_PAGE_SIZE,
    );
    const page = Math.max(Number(query.page ?? 1), 1);
    qb.orderBy('l.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [rows, total] = await qb.getManyAndCount();
    return { rows, total, page, pageSize };
  }

  /** شمارهٔ خوانای بعدی؛ همان الگوی `MR-`/`WO-`. */
  private async nextNumber(organizationId: string): Promise<string> {
    const count = await this.letters.count({ where: { organizationId } });
    return `L-${String(count + 1).padStart(5, '0')}`;
  }

  private log(
    actorId: string | undefined,
    organizationId: string,
    action: string,
    entityId: string,
    meta: Record<string, unknown>,
  ) {
    void this.audit
      ?.log({
        organizationId,
        action,
        actorType: actorId ? 'user' : 'system',
        actorId: actorId ?? null,
        payload: { entityId, ...meta },
      })
      .catch(() => undefined);
  }
}
