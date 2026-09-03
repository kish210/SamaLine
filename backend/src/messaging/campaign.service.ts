import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { DeliveryLogEntity } from '../database/entities/delivery-log.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { LogicEngineService } from '../forms/logic-engine.service';
import { MessagingService } from './messaging.service';
import type { MessageChannel, OutboundMessage } from './messaging.types';

export interface CampaignRecipient {
  /** شماره موبایل یا ایمیل. */
  to: string;
  /** نام و سایر متغیرها برای شخصی‌سازی متن با {{name}}. */
  variables?: Record<string, unknown>;
}

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(PublicationEntity)
    private readonly publicationRepo: Repository<PublicationEntity>,
    @InjectRepository(DeliveryLogEntity)
    private readonly logRepo: Repository<DeliveryLogEntity>,
    @InjectRepository(ResponseEntity)
    private readonly responseRepo: Repository<ResponseEntity>,
    private readonly messaging: MessagingService,
    private readonly logicEngine: LogicEngineService,
  ) {}

  /**
   * ارسال گروهی دعوت‌نامه.
   *
   * برای هر گیرنده یک توکن یکتا ساخته می‌شود تا:
   * - پاسخ به گیرنده قابل انتساب باشد،
   * - «ارسال مجدد به بی‌پاسخ‌ها» ممکن شود،
   * - کنترل تکرار بر اساس گیرنده کار کند.
   */
  async sendCampaign(input: {
    publicationId: string;
    channel: MessageChannel;
    recipients: CampaignRecipient[];
    template: string;
    subject?: string;
    baseUrl?: string;
  }) {
    if (!input.recipients?.length) {
      throw new BadRequestException('فهرست گیرندگان خالی است');
    }

    const publication = await this.publicationRepo.findOne({
      where: { id: input.publicationId },
    });
    if (!publication) throw new BadRequestException('انتشار پیدا نشد');

    const baseUrl =
      input.baseUrl ??
      process.env.PUBLIC_FORM_BASE_URL ??
      'http://localhost:5173/f';

    const messages: OutboundMessage[] = input.recipients.map((recipient) => {
      const respondentKey = this.buildRespondentKey(recipient.to);
      const link = `${baseUrl}/${publication.token}?r=${respondentKey}`;

      return {
        channel: input.channel,
        recipient: recipient.to,
        subject: input.subject,
        // متن با همان موتور Piping شخصی‌سازی می‌شود تا سینتکس یکسان بماند.
        body: this.logicEngine.applyPiping(input.template, {
          ...(recipient.variables ?? {}),
          link,
        }),
        meta: { respondentKey, link },
      };
    });

    return this.messaging.sendBulk(messages, input.publicationId);
  }

  /**
   * گیرندگانی که دعوت‌نامه گرفته‌اند ولی هنوز پاسخ نداده‌اند.
   * مبنای «ارسال مجدد به بی‌پاسخ‌ها» در بند ۷ سند.
   */
  async pendingRecipients(publicationId: string) {
    const logs = await this.logRepo.find({
      where: { publicationId },
      order: { createdAt: 'DESC' },
    });

    const invited = new Map<string, string>();
    for (const log of logs) {
      if (log.status === 'failed') continue;
      const payload = log.payload as {
        recipient?: string;
        respondentKey?: string;
      };
      if (payload?.recipient && payload?.respondentKey) {
        invited.set(payload.recipient, payload.respondentKey);
      }
    }

    const answered = await this.answeredRespondentKeys(publicationId);

    return [...invited.entries()]
      .filter(([, key]) => !answered.has(key))
      .map(([recipient, respondentKey]) => ({ recipient, respondentKey }));
  }

  private async answeredRespondentKeys(publicationId: string) {
    const responses = await this.responseRepo.find({
      where: { publicationId },
      select: { respondentKey: true },
    });
    return new Set(
      responses
        .map((response) => response.respondentKey)
        .filter((key): key is string => Boolean(key)),
    );
  }

  /**
   * کلید پایدار گیرنده: از هش گیرنده به‌علاوه‌ی نمک سرور ساخته می‌شود
   * تا شماره‌ی موبایل در لینک قابل خواندن نباشد ولی ارسال مجدد به
   * همان گیرنده همان کلید را بدهد.
   */
  private buildRespondentKey(recipient: string) {
    const salt = process.env.RESPONDENT_KEY_SALT ?? 'samaline';
    return createHash('sha256')
      .update(`${salt}:${recipient.trim().toLowerCase()}`)
      .digest('hex')
      .slice(0, 24);
  }

  /** توکن یکتا برای مواردی که کلید قابل بازتولید لازم نیست. */
  static randomToken() {
    return randomBytes(12).toString('hex');
  }
}
