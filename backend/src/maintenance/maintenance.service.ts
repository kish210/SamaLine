import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceRequestEntity,
  MaintenanceStatus,
} from '../database/entities/maintenance-request.entity';
import { MaintenanceEventEntity } from '../database/entities/maintenance-event.entity';
import {
  RoomReadinessEntity,
  RoomReadinessStatus,
} from '../database/entities/room-readiness.entity';
import { TenantAccessService } from '../common/tenant-access.service';
import type { JwtUser } from '../common/current-user.decorator';

export interface CreateRequestInput {
  requesterName?: string;
  building?: string;
  floor?: string;
  room?: string;
  locationNote?: string;
  category?: MaintenanceCategory;
  description: string;
  priority?: MaintenancePriority;
  assignedTo?: string;
  estimatedCost?: number;
  attachments?: Array<{ url: string; name?: string }>;
}

export interface UpdateRequestInput {
  building?: string;
  floor?: string;
  room?: string;
  locationNote?: string;
  category?: MaintenanceCategory;
  description?: string;
  priority?: MaintenancePriority;
  assignedTo?: string;
  status?: MaintenanceStatus;
  workNotes?: string;
  completionNotes?: string;
  estimatedCost?: number;
  actualCost?: number;
  attachments?: Array<{ url: string; name?: string }>;
  /** یادداشت اختیاری که در ردپای ممیزی ثبت می‌شود. */
  eventNote?: string;
}

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceRequestEntity)
    private readonly requests: Repository<MaintenanceRequestEntity>,
    @InjectRepository(MaintenanceEventEntity)
    private readonly events: Repository<MaintenanceEventEntity>,
    @InjectRepository(RoomReadinessEntity)
    private readonly rooms: Repository<RoomReadinessEntity>,
    private readonly tenant: TenantAccessService,
    private readonly dataSource: DataSource,
  ) {}

  assertAccess(workspaceId: string, user: JwtUser): Promise<void> {
    return this.tenant.assertWorkspace(workspaceId, user);
  }

  private actorName(user: JwtUser): string {
    return (user.email ?? '').slice(0, 160);
  }

  // ── درخواست‌ها ───────────────────────────────────────────────────────────

  /**
   * ساخت درخواست با شماره‌ی یکتای هر فضای کاری.
   *
   * شماره در یک تراکنش از روی بیشترین شماره‌ی موجود ساخته می‌شود؛ در صورت
   * برخورد هم‌زمان با ایندکس یکتا، چند بار دوباره تلاش می‌کند.
   */
  async createRequest(workspaceId: string, user: JwtUser, input: CreateRequestInput) {
    if (!input.description?.trim()) {
      throw new BadRequestException('شرح درخواست لازم است');
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const next = await this.nextRequestNo(workspaceId);
      try {
        const saved = await this.requests.save(
          this.requests.create({
            workspaceId,
            requestNo: String(next),
            createdByUserId: user.sub ?? null,
            requesterName: (input.requesterName ?? '').slice(0, 160),
            building: (input.building ?? '').slice(0, 120),
            floor: (input.floor ?? '').slice(0, 120),
            room: (input.room ?? '').slice(0, 120),
            locationNote: (input.locationNote ?? '').slice(0, 300),
            category: input.category ?? MaintenanceCategory.OTHER,
            description: input.description.trim(),
            priority: input.priority ?? MaintenancePriority.NORMAL,
            assignedTo: (input.assignedTo ?? '').slice(0, 160),
            status: MaintenanceStatus.NEW,
            estimatedCost: String(Math.max(0, Math.trunc(input.estimatedCost ?? 0))),
            attachments: sanitizeAttachments(input.attachments),
          }),
        );
        await this.logEvent(saved.id, user, 'created', null, saved.status, '');
        return saved;
      } catch (error) {
        if (isUniqueViolation(error) && attempt < 4) continue;
        throw error;
      }
    }
    throw new BadRequestException('ساخت شماره‌ی درخواست ناموفق بود؛ دوباره تلاش کنید');
  }

  private async nextRequestNo(workspaceId: string): Promise<number> {
    const rows = await this.requests.find({
      where: { workspaceId },
      select: { requestNo: true },
    });
    let max = 0;
    for (const row of rows) {
      const n = Number(row.requestNo);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return max + 1;
  }

  async listRequests(
    workspaceId: string,
    filters: {
      status?: MaintenanceStatus;
      category?: MaintenanceCategory;
      priority?: MaintenancePriority;
      room?: string;
      q?: string;
      includeArchived?: boolean;
    } = {},
  ) {
    const qb = this.requests
      .createQueryBuilder('r')
      .where('r.workspaceId = :workspaceId', { workspaceId });

    if (!filters.includeArchived) qb.andWhere('r.archivedAt IS NULL');
    if (filters.status) qb.andWhere('r.status = :status', { status: filters.status });
    if (filters.category) qb.andWhere('r.category = :category', { category: filters.category });
    if (filters.priority) qb.andWhere('r.priority = :priority', { priority: filters.priority });
    if (filters.room) qb.andWhere('r.room = :room', { room: filters.room });
    if (filters.q) {
      qb.andWhere('(r.description LIKE :q OR r.requestNo LIKE :q OR r.requesterName LIKE :q)', {
        q: `%${filters.q}%`,
      });
    }

    return qb.orderBy('r.createdAt', 'DESC').take(500).getMany();
  }

  async getRequest(workspaceId: string, id: string) {
    const request = await this.requests.findOne({ where: { id, workspaceId } });
    if (!request) throw new NotFoundException('درخواست یافت نشد');
    const history = await this.events.find({
      where: { requestId: id },
      order: { createdAt: 'ASC' },
    });
    return { request, history };
  }

  async updateRequest(
    workspaceId: string,
    user: JwtUser,
    id: string,
    input: UpdateRequestInput,
  ) {
    const request = await this.requests.findOne({ where: { id, workspaceId } });
    if (!request) throw new NotFoundException('درخواست یافت نشد');
    if (request.archivedAt) {
      throw new BadRequestException('درخواست بایگانی‌شده قابل تغییر نیست');
    }

    const prevStatus = request.status;
    const prevAssignee = request.assignedTo;

    const set = <K extends keyof MaintenanceRequestEntity>(
      key: K,
      value: MaintenanceRequestEntity[K] | undefined,
    ) => {
      if (value !== undefined) request[key] = value;
    };

    set('building', input.building?.slice(0, 120));
    set('floor', input.floor?.slice(0, 120));
    set('room', input.room?.slice(0, 120));
    set('locationNote', input.locationNote?.slice(0, 300));
    set('category', input.category);
    set('description', input.description?.trim());
    set('priority', input.priority);
    set('assignedTo', input.assignedTo?.slice(0, 160));
    set('status', input.status);
    set('workNotes', input.workNotes);
    set('completionNotes', input.completionNotes);
    set('attachments', sanitizeAttachments(input.attachments) as never);
    if (input.estimatedCost !== undefined)
      request.estimatedCost = String(Math.max(0, Math.trunc(input.estimatedCost)));
    if (input.actualCost !== undefined)
      request.actualCost = String(Math.max(0, Math.trunc(input.actualCost)));

    // بستن/بازکردن تیکت: closedAt همگام با وضعیت.
    if (input.status !== undefined) {
      const closing =
        input.status === MaintenanceStatus.DONE ||
        input.status === MaintenanceStatus.CANCELLED;
      request.closedAt = closing ? (request.closedAt ?? new Date()) : null;
    }

    const saved = await this.requests.save(request);

    if (input.status !== undefined && input.status !== prevStatus) {
      await this.logEvent(id, user, 'status_changed', prevStatus, input.status, input.eventNote ?? '');
    }
    if (input.assignedTo !== undefined && input.assignedTo !== prevAssignee) {
      await this.logEvent(id, user, 'assigned', prevAssignee || null, input.assignedTo || '—', '');
    }
    if (input.eventNote?.trim() && input.status === undefined) {
      await this.logEvent(id, user, 'note_added', null, null, input.eventNote.trim());
    }
    return saved;
  }

  /** حذف نرم: بایگانی برای حفظ تاریخچه‌ی عملیاتی (بدون حذف سخت). */
  async archiveRequest(workspaceId: string, user: JwtUser, id: string) {
    const request = await this.requests.findOne({ where: { id, workspaceId } });
    if (!request) throw new NotFoundException('درخواست یافت نشد');
    if (!request.archivedAt) {
      request.archivedAt = new Date();
      await this.requests.save(request);
      await this.logEvent(id, user, 'archived', null, null, '');
    }
    return { ok: true };
  }

  private async logEvent(
    requestId: string,
    user: JwtUser,
    action: string,
    fromValue: string | null,
    toValue: string | null,
    note: string,
  ) {
    await this.events.save(
      this.events.create({
        requestId,
        actorId: user.sub ?? null,
        actorName: this.actorName(user),
        action,
        fromValue,
        toValue,
        note: note.slice(0, 2000),
      }),
    );
  }

  // ── داشبورد (داده‌ی واقعی) ─────────────────────────────────────────────────

  /**
   * خلاصه‌ی عملیاتی برای بخش فنی — همه از شمارشِ واقعیِ دیتابیس، بدون عدد ثابت.
   */
  async dashboard(workspaceId: string) {
    const base = () =>
      this.requests
        .createQueryBuilder('r')
        .where('r.workspaceId = :workspaceId', { workspaceId })
        .andWhere('r.archivedAt IS NULL');

    const countWhere = async (clause: string, params: Record<string, unknown> = {}) =>
      base().andWhere(clause, params).getCount();

    const [
      total,
      unassigned,
      waitingPart,
      contractor,
      followUp,
      urgent,
      open,
      done,
    ] = await Promise.all([
      base().getCount(),
      countWhere("r.assignedTo = '' AND r.status != :done", { done: MaintenanceStatus.DONE }),
      countWhere('r.status = :s', { s: MaintenanceStatus.WAITING_PART }),
      countWhere('r.status = :s', { s: MaintenanceStatus.CONTRACTOR_REQUIRED }),
      countWhere('r.status = :s', { s: MaintenanceStatus.FOLLOW_UP }),
      countWhere('r.priority IN (:...p)', {
        p: [MaintenancePriority.URGENT, MaintenancePriority.EMERGENCY],
      }),
      countWhere('r.status NOT IN (:...c)', {
        c: [MaintenanceStatus.DONE, MaintenanceStatus.CANCELLED],
      }),
      countWhere('r.status = :s', { s: MaintenanceStatus.DONE }),
    ]);

    const groupBy = async (column: 'status' | 'category' | 'priority') => {
      const rows = await base()
        .select(`r.${column}`, 'key')
        .addSelect('COUNT(*)', 'count')
        .groupBy(`r.${column}`)
        .getRawMany<{ key: string; count: string }>();
      return rows.map((row) => ({ key: row.key, count: Number(row.count) }));
    };

    const roomRows = await this.rooms
      .createQueryBuilder('rm')
      .select('rm.status', 'key')
      .addSelect('COUNT(*)', 'count')
      .where('rm.workspaceId = :workspaceId', { workspaceId })
      .groupBy('rm.status')
      .getRawMany<{ key: string; count: string }>();

    return {
      totals: { total, open, unassigned, waitingPart, contractor, followUp, urgent, done },
      byStatus: await groupBy('status'),
      byCategory: await groupBy('category'),
      byPriority: await groupBy('priority'),
      roomReadiness: roomRows.map((r) => ({ key: r.key, count: Number(r.count) })),
    };
  }

  // ── آماده‌بودن اتاق (مستقل از وضعیت درخواست) ───────────────────────────────

  listRooms(workspaceId: string) {
    return this.rooms.find({ where: { workspaceId }, order: { room: 'ASC' } });
  }

  /**
   * تعیین/به‌روزرسانی آماده‌بودن یک اتاق. عمداً هیچ ربطی به بسته‌شدن تیکت ندارد؛
   * تصمیمِ انسانیِ جداست. آخرین تغییر (چه کسی/کِی/چرا) روی خودِ ردیف می‌ماند.
   */
  async setRoomReadiness(
    workspaceId: string,
    user: JwtUser,
    input: {
      room: string;
      building?: string;
      floor?: string;
      status: RoomReadinessStatus;
      note?: string;
    },
  ) {
    const room = input.room?.trim();
    if (!room) throw new BadRequestException('شماره اتاق لازم است');
    if (!Object.values(RoomReadinessStatus).includes(input.status)) {
      throw new BadRequestException('وضعیت آماده‌بودن نامعتبر است');
    }

    const existing = await this.rooms.findOne({ where: { workspaceId, room } });
    const entity =
      existing ??
      this.rooms.create({ workspaceId, room: room.slice(0, 120) });
    if (input.building !== undefined) entity.building = input.building.slice(0, 120);
    if (input.floor !== undefined) entity.floor = input.floor.slice(0, 120);
    entity.status = input.status;
    entity.note = (input.note ?? '').slice(0, 300);
    entity.updatedByName = this.actorName(user);
    return this.rooms.save(entity);
  }
}

function sanitizeAttachments(
  attachments?: Array<{ url: string; name?: string }>,
): Array<{ url: string; name: string }> {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .filter((a) => a && typeof a.url === 'string')
    .slice(0, 20)
    .map((a) => ({ url: a.url.slice(0, 500), name: String(a.name ?? '').slice(0, 160) }));
}

/** تشخیص خطای نقضِ یکتایی (SQLite و Postgres). */
function isUniqueViolation(error: unknown): boolean {
  const message = (error as { message?: string })?.message ?? '';
  const code = (error as { code?: string })?.code ?? '';
  return (
    code === '23505' || // Postgres unique_violation
    /UNIQUE constraint failed/i.test(message) ||
    /duplicate key/i.test(message)
  );
}
