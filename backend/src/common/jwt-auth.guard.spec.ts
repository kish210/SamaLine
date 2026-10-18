jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
// خود passport جایگزین می‌شود تا فقط تصمیم نقش آزموده شود.
jest.mock('@nestjs/passport', () => ({
  AuthGuard: () =>
    class {
      canActivate() {
        return Promise.resolve(true);
      }
    },
}));

import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MinRole } from './roles';

/** نگهبان نقش‌ها پس از احراز هویت. */
describe('JwtAuthGuard — حداقل نقش', () => {
  class Routes {}
  const read = () => undefined;
  const write = () => undefined;
  const exportData = () => undefined;
  // همان کاری که تزئین روی یک متد می‌کند: فراداده روی خود تابع.
  MinRole(OrganizationRole.ANALYST)(exportData);
  @MinRole(OrganizationRole.ADMIN)
  class AdminRoutes {}
  const list = () => undefined;

  const contextFor = (
    method: string,
    role: OrganizationRole | undefined,
    handler: () => void,
    cls: unknown = Routes,
  ) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ method, user: { role } }) }),
      getHandler: () => handler,
      getClass: () => cls,
    }) as never;

  /** درخواستی که با کلید API می‌آید؛ هویتش را گارد خودش می‌نشاند. */
  const apiKeyContext = (
    method: string,
    path: string,
    role: OrganizationRole,
    handler: () => void = write,
  ) => {
    const request: Record<string, unknown> = {
      method,
      path,
      headers: { 'x-api-key': 'sl_test' },
    };
    return {
      request,
      context: {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => handler,
        getClass: () => Routes,
      } as never,
    };
  };

  const apiKeys = (role: OrganizationRole) =>
    ({
      authenticate: () =>
        Promise.resolve({
          sub: 'apikey:1',
          email: 'k',
          organizationId: 'org',
          workspaceId: null,
          role,
        }),
    }) as never;

  const guard = new JwtAuthGuard(new Reflector());
  const run = (...args: Parameters<typeof contextFor>) =>
    guard.canActivate(contextFor(...args));

  it('بدون تزئین: خواندن برای بیننده آزاد، تغییر دست‌کم ویرایشگر', async () => {
    await expect(run('GET', OrganizationRole.VIEWER, read)).resolves.toBe(true);
    await expect(run('POST', OrganizationRole.VIEWER, write)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      run('DELETE', OrganizationRole.ANALYST, write),
    ).rejects.toThrow('ویرایشگر');
    await expect(run('PATCH', OrganizationRole.EDITOR, write)).resolves.toBe(
      true,
    );
  });

  it('تزئین مسیر بر پیش‌فرض روش HTTP مقدم است', async () => {
    await expect(
      run('GET', OrganizationRole.VIEWER, exportData),
    ).rejects.toThrow('تحلیلگر');
    await expect(
      run('GET', OrganizationRole.ANALYST, exportData),
    ).resolves.toBe(true);
  });

  it('تزئین کلاس، حتی خواندن را محدود می‌کند', async () => {
    await expect(
      run('GET', OrganizationRole.EDITOR, list, AdminRoutes),
    ).rejects.toThrow('مدیر');
    await expect(
      run('GET', OrganizationRole.OWNER, list, AdminRoutes),
    ).resolves.toBe(true);
  });

  it('کاربر بدون نقش (عضویت نامعلوم) هیچ دسترسی ندارد', async () => {
    await expect(run('GET', undefined, read)).rejects.toThrow(
      ForbiddenException,
    );
  });

  describe('کلید API', () => {
    it('هویت از کلید می‌آید و نقش کلید اعمال می‌شود', async () => {
      const guard = new JwtAuthGuard(
        new Reflector(),
        apiKeys(OrganizationRole.EDITOR),
      );
      const { context, request } = apiKeyContext(
        'POST',
        '/api/v1/forms',
        OrganizationRole.EDITOR,
      );
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect((request.user as { sub: string }).sub).toBe('apikey:1');
    });

    it('کلید کم‌اختیار همان محدودیت عضو تیم را دارد', async () => {
      const guard = new JwtAuthGuard(
        new Reflector(),
        apiKeys(OrganizationRole.VIEWER),
      );
      const { context } = apiKeyContext(
        'POST',
        '/api/v1/forms',
        OrganizationRole.VIEWER,
      );
      await expect(guard.canActivate(context)).rejects.toThrow('ویرایشگر');
    });

    /*
     * مهم‌ترین مرز: کلیدی با نقش «مدیر» هم نباید به ساخت کلید تازه، دعوت
     * هم‌تیمی یا تغییر رمز برسد؛ وگرنه یک کلید لو رفته کل سازمان را می‌گرفت.
     */
    it('مسیرهای حساب و مالکیت سازمان حتی برای کلید مدیر بسته‌اند', async () => {
      const guard = new JwtAuthGuard(
        new Reflector(),
        apiKeys(OrganizationRole.ADMIN),
      );
      for (const path of [
        '/api/v1/organization/api-keys',
        '/api/v1/team/invitations',
        '/api/v1/auth/password',
      ]) {
        const { context } = apiKeyContext('POST', path, OrganizationRole.ADMIN);
        await expect(guard.canActivate(context)).rejects.toThrow(
          'با کلید API در دسترس نیست',
        );
      }
    });
  });
});
