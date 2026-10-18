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
import { PlanService } from '../plans/plan.service';
import { CreateDeliveryLogDto } from './dto';

/**
 * کدام نوع انتشار به کدام امکان پلن وابسته است.
 *
 * نوع‌های پایه (لینک، QR، شبکه‌های اجتماعی و اپ) در همه‌ی پلن‌ها هستند و
 * اینجا نمی‌آیند. پیامک و ایمیل سقف خودشان را سر ارسال کمپین می‌خورند.
 */
const PUBLICATION_FEATURE: Partial<Record<PublicationType, string>> = {
  [PublicationType.EMBED]: 'embed',
  [PublicationType.POPUP]: 'embed',
  [PublicationType.KIOSK]: 'kiosk',
  [PublicationType.PORTAL]: 'portal',
  [PublicationType.INTERVIEWER]: 'interviewer',
};

/** امکاناتی که سقفشان شمارشی است، نه بله/خیر. */
const COUNTED_FEATURES = new Set(['kiosk', 'portal', 'interviewer']);

@Injectable()
export class DistributionService {
  constructor(
    @InjectRepository(DeliveryLogEntity)
    private readonly logRepo: Repository<DeliveryLogEntity>,
    @InjectRepository(PublicationEntity)
    private readonly publicationRepo: Repository<PublicationEntity>,
    private readonly plans: PlanService,
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

  async createChannelPublication(
    formId: string,
    type: PublicationType,
    organizationId?: string,
  ) {
    // نوع از مسیر نشانی می‌آید؛ مقدار ناشناخته نباید به دیتابیس برسد.
    if (!Object.values(PublicationType).includes(type)) {
      throw new BadRequestException('نوع انتشار نامعتبر است');
    }
    await this.assertPlanAllows(type, organizationId);
    const publication = this.publicationRepo.create({
      formId,
      type,
      token: randomBytes(16).toString('hex'),
      config: {},
      isActive: true,
    });
    return this.publicationRepo.save(publication);
  }

  /**
   * کیوسک، پرتال، پرسشگر و Embed امکانات پلن‌اند.
   *
   * سقف شمارشی روی انتشارهای فعال همین سازمان حساب می‌شود، نه روی هر فرم؛
   * وگرنه با ساختن فرم تازه می‌شد بی‌نهایت کیوسک داشت.
   */
  private async assertPlanAllows(
    type: PublicationType,
    organizationId?: string,
  ) {
    const feature = PUBLICATION_FEATURE[type];
    if (!feature || !organizationId) return;

    if (!COUNTED_FEATURES.has(feature)) {
      await this.plans.assertFeature(organizationId, feature);
      return;
    }

    const used = await this.publicationRepo
      .createQueryBuilder('publication')
      .innerJoin('forms', 'form', 'form.id = publication.formId')
      .innerJoin('workspaces', 'workspace', 'workspace.id = form.workspaceId')
      .where('workspace.organizationId = :organizationId', { organizationId })
      .andWhere('publication.type = :type', { type })
      .andWhere('publication.isActive = :active', { active: true })
      .getCount();
    await this.plans.assertQuota(organizationId, feature, used);
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
