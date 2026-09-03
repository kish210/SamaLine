import { createHmac } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEntity } from '../database/entities/webhook.entity';
import { CreateWebhookDto } from './dto';

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(WebhookEntity)
    private readonly webhookRepo: Repository<WebhookEntity>,
  ) {}

  createWebhook(dto: CreateWebhookDto) {
    return this.webhookRepo.save(this.webhookRepo.create(dto));
  }

  listWebhooks(organizationId: string) {
    return this.webhookRepo.find({
      where: { organizationId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  signPayload(secret: string, payload: Record<string, unknown>) {
    return createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  async buildDispatch(
    event: string,
    organizationId: string,
    payload: Record<string, unknown>,
  ) {
    const hooks = await this.webhookRepo.find({
      where: { event, organizationId, isActive: true },
    });
    return hooks.map((hook) => ({
      url: hook.targetUrl,
      signature: this.signPayload(hook.secret, payload),
      payload,
      retryPolicy: { maxAttempts: 5, strategy: 'exponential-backoff' },
    }));
  }
}
