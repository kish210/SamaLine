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

  describe('سوئیچ ثبت‌نام', () => {
    it('روی نصب تازه ثبت‌نام باز است', async () => {
      expect(await service.isRegistrationOpen()).toBe(true);
    });

    it('با خاموش‌کردن، ولی تا وقتی کاربری نیست، bootstrap باز می‌ماند', async () => {
      await service.update({ registrationEnabled: false });
      // هیچ کاربری ساخته نشده؛ نصب تازه نباید قفل شود.
      expect(await service.isRegistrationOpen()).toBe(true);
    });

    it('با خاموش‌کردن و وجود کاربر، ثبت‌نام بسته می‌شود', async () => {
      await makeUser(false);
      await service.update({ registrationEnabled: false });
      expect(await service.isRegistrationOpen()).toBe(false);
      expect((await service.publicConfig()).registrationEnabled).toBe(false);
    });
  });

  describe('تنظیمات هوش مصنوعی', () => {
    it('پیش‌فرض ماک است و کلیدی ندارد', async () => {
      const config = await service.getAiConfig();
      expect(config.provider).toBe('mock');
      expect(config.apiKey).toBe('');
    });

    it('کلید API رمزشده ذخیره و رمزگشایی‌شده خوانده می‌شود', async () => {
      await service.update({
        aiProvider: 'openai',
        aiBaseUrl: 'https://api.openai.com/v1',
        aiModel: 'gpt-4o-mini',
        aiApiKey: 'sk-secret-123',
      });
      // در دیتابیس باید رمزشده بنشیند، نه خام.
      const stored = await service.get();
      expect(stored.aiApiKey.startsWith('enc:v1:')).toBe(true);
      expect(stored.aiApiKey).not.toContain('sk-secret-123');
      // ولی خواندن داخلی مقدار واقعی را می‌دهد.
      const config = await service.getAiConfig();
      expect(config.provider).toBe('openai');
      expect(config.apiKey).toBe('sk-secret-123');
    });

    it('کلید خالی، کلید قبلی را پاک نمی‌کند', async () => {
      await service.update({ aiProvider: 'openai', aiApiKey: 'sk-keep' });
      await service.update({ aiModel: 'other' });
      expect((await service.getAiConfig()).apiKey).toBe('sk-keep');
    });

    it('با «-» کلید عمدا پاک می‌شود', async () => {
      await service.update({ aiApiKey: 'sk-del' });
      await service.update({ aiApiKey: '-' });
      expect((await service.getAiConfig()).apiKey).toBe('');
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
