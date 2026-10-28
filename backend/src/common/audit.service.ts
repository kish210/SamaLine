import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../database/entities/audit-log.entity';

export interface AuditEntry {
  organizationId: string;
  action: string;
  actorType?: 'user' | 'api-key' | 'system';
  actorId?: string | null;
  payload?: Record<string, unknown>;
}

/**
 * ثبتِ رویدادهای مهمِ ممیزی (چه کسی کِی چه کرد).
 *
 * جدولِ `audit_logs` از ابتدا بود ولی چیزی در آن نوشته نمی‌شد (REMAINING #۲۰).
 * این سرویس آن را پر می‌کند. نوشتن **بهترین‌تلاش** است: هرگز throw نمی‌کند تا
 * شکستِ ثبتِ لاگ، خودِ عملیات (تأیید، انتشار، …) را متوقف نکند.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      if (!entry.organizationId || !entry.action) return;
      await this.repo.save(
        this.repo.create({
          organizationId: entry.organizationId,
          action: entry.action.slice(0, 120),
          actorType: entry.actorType ?? 'user',
          actorId: entry.actorId ?? null,
          payload: entry.payload ?? {},
        }),
      );
    } catch (error) {
      this.logger.warn(`ثبتِ لاگِ ممیزی ناموفق: ${(error as Error).message}`);
    }
  }

  /** رویدادهای اخیرِ یک سازمان (برای نمای ممیزی). */
  list(organizationId: string, limit = 200) {
    return this.repo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 1000),
    });
  }
}
