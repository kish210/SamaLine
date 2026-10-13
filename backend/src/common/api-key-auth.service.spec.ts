jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { ApiKeyEntity } from '../database/entities/api-key.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { createTestDataSource } from '../testing/test-database';
import {
  ApiKeyAuthService,
  apiKeyFromHeaders,
  hashApiKey,
  isForbiddenForApiKey,
} from './api-key-auth.service';

describe('خواندن کلید از سربرگ', () => {
  it('هم X-API-Key و هم Bearer با پیشوند sl_', () => {
    expect(apiKeyFromHeaders({ 'x-api-key': ' sl_abc ' })).toBe('sl_abc');
    expect(apiKeyFromHeaders({ authorization: 'Bearer sl_abc' })).toBe(
      'sl_abc',
    );
    expect(apiKeyFromHeaders({ authorization: 'bearer sl_abc' })).toBe(
      'sl_abc',
    );
  });

  it('توکن ورود پنل کلید API شمرده نمی‌شود', () => {
    // توکن JWT با sl_ شروع نمی‌شود؛ باید به مسیر همیشگی passport برود.
    expect(apiKeyFromHeaders({ authorization: 'Bearer eyJhbGciOi.x.y' })).toBe(
      '',
    );
    expect(apiKeyFromHeaders({})).toBe('');
    expect(apiKeyFromHeaders({ authorization: 'Basic sl_abc' })).toBe('');
  });
});

describe('مسیرهای ممنوع برای کلید API', () => {
  it('حساب، تیم، فاکتور، سازمان و بخش مدیر کل بسته‌اند', () => {
    for (const path of [
      '/api/v1/auth/password',
      '/api/v1/team/invitations',
      '/api/v1/billing/invoices',
      '/api/v1/organization/api-keys',
      '/api/v1/admin/organizations-overview',
      '/api/v1/platform/settings',
      '/api/v1/ops/services/x/restart',
    ]) {
      expect(isForbiddenForApiKey(path)).toBe(true);
    }
  });

  it('مسیرهای کاری باز می‌مانند', () => {
    for (const path of [
      '/api/v1/forms',
      '/api/v1/responses/form/1',
      '/api/v1/reports/forms/1/summary',
      '/api/v1/contacts/lists',
      '/api/v1/dashboards',
    ]) {
      expect(isForbiddenForApiKey(path)).toBe(false);
    }
  });

  it('مسیر مشابه ولی متفاوت را ممنوع نمی‌کند', () => {
    // «/authoring» با «/auth» شروع می‌شود ولی مسیر دیگری است.
    expect(isForbiddenForApiKey('/api/v1/authoring')).toBe(false);
  });
});

describe('ApiKeyAuthService — احراز هویت با کلید', () => {
  let ds: DataSource;
  let service: ApiKeyAuthService;
  let organizationId: string;
  let workspaceId: string;

  const KEY = `sl_${'a'.repeat(36)}`;

  const saveKey = (over: Partial<ApiKeyEntity> = {}) =>
    ds.getRepository(ApiKeyEntity).save({
      organizationId,
      name: 'کلید تست',
      keyPrefix: KEY.slice(0, 16),
      keyHash: hashApiKey(KEY),
      role: OrganizationRole.ANALYST,
      isActive: true,
      scopes: {},
      ...over,
    });

  beforeEach(async () => {
    ds = await createTestDataSource();
    organizationId = (
      await ds.getRepository(OrganizationEntity).save({ name: 'سازمان' })
    ).id;
    workspaceId = (
      await ds
        .getRepository(WorkspaceEntity)
        .save({ organizationId, name: 'فضا' })
    ).id;
    service = new ApiKeyAuthService(
      ds.getRepository(ApiKeyEntity),
      ds.getRepository(WorkspaceEntity),
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('کلید درست، هویتِ سازمان با نقش خودش می‌دهد', async () => {
    await saveKey();
    const user = await service.authenticate(KEY);
    expect(user).toMatchObject({
      organizationId,
      workspaceId,
      role: OrganizationRole.ANALYST,
    });
    // کاربر واقعی نیست؛ همین باعث می‌شود بررسی سوپرادمین ردش کند.
    expect(user.sub.startsWith('apikey:')).toBe(true);
  });

  it('کلید اشتباه با همان پیشوند رد می‌شود', async () => {
    await saveKey();
    const samePrefix = `${KEY.slice(0, 16)}${'b'.repeat(20)}`;
    await expect(service.authenticate(samePrefix)).rejects.toThrow('نامعتبر');
  });

  it('کلید ناشناس، غیرفعال و منقضی رد می‌شوند', async () => {
    await expect(service.authenticate(KEY)).rejects.toThrow('نامعتبر');

    const key = await saveKey({ isActive: false });
    await expect(service.authenticate(KEY)).rejects.toThrow('نامعتبر');

    await ds.getRepository(ApiKeyEntity).update(key.id, {
      isActive: true,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(service.authenticate(KEY)).rejects.toThrow('منقضی');
  });

  it('چیزی که با sl_ شروع نشود اصلا کلید نیست', async () => {
    await saveKey();
    await expect(service.authenticate('eyJhbGciOi')).rejects.toThrow('نامعتبر');
  });

  it('آخرین استفاده ثبت می‌شود ولی هر درخواست یک نوشتن نمی‌خواهد', async () => {
    const key = await saveKey();
    await service.authenticate(KEY);
    const first = (
      await ds.getRepository(ApiKeyEntity).findOneByOrFail({ id: key.id })
    ).lastUsedAt;
    expect(first).toBeInstanceOf(Date);

    await service.authenticate(KEY);
    const second = (
      await ds.getRepository(ApiKeyEntity).findOneByOrFail({ id: key.id })
    ).lastUsedAt;
    expect(second?.getTime()).toBe(first?.getTime());
  });

  it('کلید سازمان بی‌فضای کاری هم کار می‌کند', async () => {
    const other = await ds
      .getRepository(OrganizationEntity)
      .save({ name: 'بدون فضا' });
    await saveKey({ organizationId: other.id });
    const user = await service.authenticate(KEY);
    expect(user.workspaceId).toBeNull();
  });
});
