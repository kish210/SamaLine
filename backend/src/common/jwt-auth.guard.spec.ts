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
});
