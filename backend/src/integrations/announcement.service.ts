import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnnouncementEntity } from '../database/entities/announcement.entity';
import { StaffNotifyService } from './staff-notify.service';

export interface AnnouncementInput {
  title: string;
  body: string;
  departmentId?: string | null;
}

/**
 * مرکزِ اطلاع‌رسانی (فاز G): اطلاعیه را به بله می‌فرستد و ماندگار ثبت می‌کند.
 *
 * ثبت پس از ارسال انجام می‌شود تا شمارِ واقعیِ گیرنده‌ها هم ذخیره شود. حتی اگر
 * هیچ پرسنلی وصل‌به‌ربات نباشد، اطلاعیه ثبت می‌شود (تاریخچه/مَمیزی مستقل از بله).
 */
@Injectable()
export class AnnouncementService {
  constructor(
    @InjectRepository(AnnouncementEntity)
    private readonly repo: Repository<AnnouncementEntity>,
    private readonly staffNotify: StaffNotifyService,
  ) {}

  list(organizationId: string) {
    return this.repo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async create(
    organizationId: string,
    sentByEmail: string,
    input: AnnouncementInput,
  ) {
    const departmentId = input.departmentId ?? null;
    const result = await this.staffNotify.broadcastAnnouncement({
      organizationId,
      title: input.title,
      body: input.body,
      departmentId,
    });

    const announcement = await this.repo.save(
      this.repo.create({
        organizationId,
        departmentId,
        title: input.title.slice(0, 120),
        body: input.body,
        sentByEmail: sentByEmail.slice(0, 160),
        recipientCount: result.sent,
      }),
    );

    return { ...result, announcement };
  }
}
