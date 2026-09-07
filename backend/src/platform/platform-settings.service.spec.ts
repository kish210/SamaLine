jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
  TypeOrmModule: { forFeature: () => ({}), forRoot: () => ({}) },
}));

import type { DataSource } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { PlatformSettingsEntity } from '../database/entities/platform-settings.entity';
import { UserEntity } from '../database/entities/user.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { SuperAdminGuard } from '../common/super-admin.guard';
import { createTestDataSource } from '../testing/test-database';
import {
  DEFAULT_FOOTER_TEXT,
  DEFAULT_FOOTER_URL,
  PlatformSettingsService,
} from './platform-settings.service';

/** ExecutionContext ساختگی با کاربر مشخص. */
const ctxFor = (sub?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => (sub ? { user: { sub } } : {}),
    }),
  }) as never;

describe('تنظیمات سکو و سوپرادمین', () => {
  let ds: DataSource;
  let service: PlatformSettingsService;

  beforeEach(async () => {
    ds = await createTestDataSource();
    service = new PlatformSettingsService(
        ds.getRepository(PlatformSettingsEntity),
        ds.getRepository(UserEntity),
        ds.getRepository(WorkspaceEntity),
      );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  const makeUser = (isSuperAdmin: boolean) =>
    ds.getRepository(UserEntity).save({
      fullName: 'کاربر',
      email: `u${Math.random()}@test.local`,
      passwordHash: 'x',
      isSuperAdmin,
    });

  describe('نوار پایین', () => {
    it('روی نصب تازه، نوار روشن است و متن پیش‌فرض دارد', async () => {
      const footer = await service.publicFooter();
      expect(footer.enabled).toBe(true);
      expect(footer.text).toBe(DEFAULT_FOOTER_TEXT);
      expect(footer.url).toBe(DEFAULT_FOOTER_URL);
    });

    it('فراخوانی مکرر بیش از یک ردیف نمی‌سازد', async () => {
      await Promise.all([service.get(), service.get(), service.get()]);
      const count = await ds.getRepository(PlatformSettingsEntity).count();
      expect(count).toBe(1);
    });

    it('سوپرادمین می‌تواند متن را عوض کند یا نوار را خاموش کند', async () => {
      await service.update({ footerText: 'شرکت نمونه', footerEnabled: false });
      const footer = await service.publicFooter();
      expect(footer.text).toBe('شرکت نمونه');
      expect(footer.enabled).toBe(false);
    });

    it('متن خالی به متن پیش‌فرض برمی‌گردد', async () => {
      await service.update({ footerText: 'چیزی' });
      await service.update({ footerText: '   ' });
      expect((await service.publicFooter()).text).toBe(DEFAULT_FOOTER_TEXT);
    });

    it('نشانی غیر http رد می‌شود', async () => {
      // این مقدار در href صفحه‌ی پاسخ‌دهنده می‌نشیند.
      await service.update({ footerUrl: 'javascript:alert(1)' });
      const saved = await service.get();
      expect(saved.footerUrl).toBe('');
    });

    it('نشانی https پذیرفته می‌شود', async () => {
      await service.update({ footerUrl: 'https://kishwifi.com' });
      expect((await service.publicFooter()).url).toBe('https://kishwifi.com');
    });
  });

  describe('گارد سوپرادمین', () => {
    let guard: SuperAdminGuard;

    beforeEach(() => {
      guard = new SuperAdminGuard(ds.getRepository(UserEntity));
    });

    it('کاربر عادی رد می‌شود', async () => {
      const user = await makeUser(false);
      await expect(guard.canActivate(ctxFor(user.id))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('سوپرادمین پذیرفته می‌شود', async () => {
      const user = await makeUser(true);
      await expect(guard.canActivate(ctxFor(user.id))).resolves.toBe(true);
    });

    it('درخواست بدون کاربر رد می‌شود', async () => {
      await expect(guard.canActivate(ctxFor())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('پس از لغو نقش، توکن قدیمی هم دیگر کار نمی‌کند', async () => {
      // گارد از دیتابیس می‌خواند نه از ادعای توکن؛ همین آزمون آن تصمیم را قفل می‌کند.
      const user = await makeUser(true);
      await expect(guard.canActivate(ctxFor(user.id))).resolves.toBe(true);

      await ds
        .getRepository(UserEntity)
        .update({ id: user.id }, { isSuperAdmin: false });

      await expect(guard.canActivate(ctxFor(user.id))).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
