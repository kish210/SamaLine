import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { DeliveryLogEntity } from '../database/entities/delivery-log.entity';
import {
  PublicationEntity,
  PublicationType,
} from '../database/entities/publication.entity';
import { CreateDeliveryLogDto } from './dto';

@Injectable()
export class DistributionService {
  constructor(
    @InjectRepository(DeliveryLogEntity)
    private readonly logRepo: Repository<DeliveryLogEntity>,
    @InjectRepository(PublicationEntity)
    private readonly publicationRepo: Repository<PublicationEntity>,
  ) {}

  createLog(dto: CreateDeliveryLogDto) {
    return this.logRepo.save(
      this.logRepo.create({
        publicationId: dto.publicationId,
        channel: dto.channel,
        status: dto.status,
        payload: dto.payload ?? {},
        providerMessage: dto.providerMessage ?? null,
      }),
    );
  }

  listLogs(publicationId: string) {
    return this.logRepo.find({
      where: { publicationId },
      order: { createdAt: 'DESC' },
    });
  }

  async createChannelPublication(formId: string, type: PublicationType) {
    // نوع از مسیر نشانی می‌آید؛ مقدار ناشناخته نباید به دیتابیس برسد.
    if (!Object.values(PublicationType).includes(type)) {
      throw new BadRequestException('نوع انتشار نامعتبر است');
    }
    const publication = this.publicationRepo.create({
      formId,
      type,
      token: randomBytes(16).toString('hex'),
      config: {},
      isActive: true,
    });
    return this.publicationRepo.save(publication);
  }

  async channelAssets(publicationId: string) {
    const publication = await this.publicationRepo.findOne({
      where: { id: publicationId },
    });
    if (!publication) throw new NotFoundException('انتشار پیدا نشد');

    /*
     * پیش از این نشانی ثابت `survey.local` برمی‌گشت که هیچ‌جا باز نمی‌شد.
     * حالا از PUBLIC_URL ساخته می‌شود؛ بدون آن نشانی نسبی است و پنل خودش
     * میزبان را جلویش می‌گذارد.
     */
    const base = (process.env.PUBLIC_URL ?? '').replace(/\/+$/, '');
    const path = publication.type === PublicationType.KIOSK ? 'k' : 'f';
    const formUrl = `${base}/${path}/${publication.token}`;
    return {
      publicationId,
      type: publication.type,
      formUrl,
      qrText: formUrl,
      embedIframe: `<iframe src="${formUrl}" style="width:100%;height:620px;border:0"></iframe>`,
      popupScript: `<script>window.open('${formUrl}','_blank','width=500,height=700')</script>`,
      ogPreview: {
        title: 'نظرسنجی جدید',
        description: 'لطفا در نظرسنجی شرکت کنید',
        url: formUrl,
      },
    };
  }
}
