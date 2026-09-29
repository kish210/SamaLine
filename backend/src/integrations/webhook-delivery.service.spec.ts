jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { DataSource } from 'typeorm';
import { WebhookEntity } from '../database/entities/webhook.entity';
import { createTestDataSource } from '../testing/test-database';
import {
  signWebhookBody,
  WEBHOOK_JOB,
  WebhookDeliveryService,
} from './webhook-delivery.service';

describe('تحویل وبهوک', () => {
  let ds: DataSource;
  let service: WebhookDeliveryService;
  let enqueued: Array<{ kind: string; payload: Record<string, unknown> }>;
  let server: Server;
  let received: Array<{ headers: Record<string, unknown>; body: string }>;
  let status: number;
  let url: string;
  const originalAllow = process.env.ALLOW_PRIVATE_CONTACT_SOURCES;

  beforeEach(async () => {
    ds = await createTestDataSource();
    enqueued = [];
    const queue = {
      register: jest.fn(),
      enqueue: async (kind: string, payload: Record<string, unknown>) => {
        enqueued.push({ kind, payload });
      },
    };
    service = new WebhookDeliveryService(
      ds.getRepository(WebhookEntity),
      queue as never,
    );

    received = [];
    status = 200;
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        received.push({ headers: req.headers, body });
        res.statusCode = status;
        res.end();
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
  });

  afterEach(async () => {
    process.env.ALLOW_PRIVATE_CONTACT_SOURCES = originalAllow;
    await new Promise((resolve) => server.close(resolve));
    await ds.destroy();
  });

  const hook = (overrides: Partial<WebhookEntity> = {}) =>
    ds.getRepository(WebhookEntity).save({
      organizationId: 'org-1',
      event: 'response.completed',
      targetUrl: url,
      secret: 'super-secret-value',
      isActive: true,
      ...overrides,
    });

  it('فقط برای وبهوک‌های فعال همان سازمان کار ثبت می‌شود', async () => {
    await hook();
    await hook({ organizationId: 'org-2' });
    await hook({ isActive: false });

    const count = await service.dispatch('org-1', 'response.completed', {
      x: 1,
    });

    expect(count).toBe(1);
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0].kind).toBe(WEBHOOK_JOB);
  });

  it('بدنه‌ی امضاشده را به مقصد می‌فرستد', async () => {
    // مقصد آزمون روی لوکال‌هاست است.
    process.env.ALLOW_PRIVATE_CONTACT_SOURCES = 'true';
    const saved = await hook();

    await service.deliver({
      webhookId: saved.id,
      event: 'response.completed',
      occurredAt: '2026-09-29T00:00:00.000Z',
      data: { response: { id: 'r1' } },
    });

    expect(received).toHaveLength(1);
    const { headers, body } = received[0];
    const expected = `sha256=${createHmac('sha256', 'super-secret-value').update(body).digest('hex')}`;
    expect(headers['x-samaline-signature']).toBe(expected);
    expect(headers['x-samaline-event']).toBe('response.completed');
    expect(JSON.parse(body)).toEqual({
      event: 'response.completed',
      occurredAt: '2026-09-29T00:00:00.000Z',
      data: { response: { id: 'r1' } },
    });
  });

  it('پاسخ غیر 2xx خطا می‌دهد تا صف دوباره تلاش کند', async () => {
    process.env.ALLOW_PRIVATE_CONTACT_SOURCES = 'true';
    status = 500;
    const saved = await hook();

    await expect(
      service.deliver({ webhookId: saved.id, event: 'response.completed' }),
    ).rejects.toThrow('500');
  });

  it('نشانی شبکه‌ی داخلی تحویل داده نمی‌شود (SSRF)', async () => {
    delete process.env.ALLOW_PRIVATE_CONTACT_SOURCES;
    const saved = await hook();

    await service.deliver({ webhookId: saved.id, event: 'response.completed' });

    expect(received).toHaveLength(0);
  });

  it('وبهوک غیرفعال‌شده پس از ثبت رویداد، بی‌صدا رد می‌شود', async () => {
    process.env.ALLOW_PRIVATE_CONTACT_SOURCES = 'true';
    const saved = await hook({ isActive: false });

    await service.deliver({ webhookId: saved.id, event: 'response.completed' });

    expect(received).toHaveLength(0);
  });

  it('امضا روی بدنه‌ی خام محاسبه می‌شود', () => {
    expect(signWebhookBody('k', '{}')).toBe(
      `sha256=${createHmac('sha256', 'k').update('{}').digest('hex')}`,
    );
  });
});
