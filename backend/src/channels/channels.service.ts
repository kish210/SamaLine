import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterviewerQuotaEntity } from '../database/entities/interviewer-quota.entity';
import { KioskSessionEntity } from '../database/entities/kiosk-session.entity';
import {
  ConsumeQuotaDto,
  CreateInterviewerQuotaDto,
  StartKioskSessionDto,
  SyncKioskPayloadDto,
} from './dto';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(KioskSessionEntity)
    private readonly kioskRepo: Repository<KioskSessionEntity>,
    @InjectRepository(InterviewerQuotaEntity)
    private readonly quotaRepo: Repository<InterviewerQuotaEntity>,
  ) {}

  startKioskSession(dto: StartKioskSessionDto) {
    return this.kioskRepo.save(
      this.kioskRepo.create({
        publicationId: dto.publicationId,
        deviceCode: dto.deviceCode,
        isLocked: true,
      }),
    );
  }

  async syncKioskSession(id: string, dto: SyncKioskPayloadDto) {
    const session = await this.kioskRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('جلسه کیوسک یافت نشد');

    session.lastSyncPayload = dto.payload;
    session.lastSyncedAt = new Date();
    return this.kioskRepo.save(session);
  }

  listKioskSessions(publicationId: string) {
    return this.kioskRepo.find({
      where: { publicationId },
      order: { updatedAt: 'DESC' },
    });
  }

  createInterviewerQuota(dto: CreateInterviewerQuotaDto) {
    return this.quotaRepo.save(
      this.quotaRepo.create({
        publicationId: dto.publicationId,
        interviewerName: dto.interviewerName,
        assignedQuota: dto.assignedQuota,
        usedQuota: 0,
      }),
    );
  }

  listInterviewerQuotas(publicationId: string) {
    return this.quotaRepo.find({
      where: { publicationId },
      order: { createdAt: 'DESC' },
    });
  }

  async consumeQuota(id: string, dto: ConsumeQuotaDto) {
    const quota = await this.quotaRepo.findOne({ where: { id } });
    if (!quota) throw new NotFoundException('سهمیه یافت نشد');

    const amount = Number(dto.amount ?? 1);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('مقدار مصرف نامعتبر است');
    }

    const allowOverUsage = Boolean(dto.allowOverUsage);
    if (!allowOverUsage && quota.usedQuota + amount > quota.assignedQuota) {
      throw new BadRequestException('سهمیه پرسشگر تکمیل شده است');
    }

    quota.usedQuota += amount;
    return this.quotaRepo.save(quota);
  }
}
