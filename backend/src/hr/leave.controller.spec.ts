jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
/*
 * کنترلر نگهبانِ JWT را وارد می‌کند و آن به @nestjs/passport می‌رسد که
 * ESM است و Jest بارش نمی‌کند. نگهبان در این آزمون‌ها نقشی ندارد: قاعده‌ی
 * «برای چه کسی» داخلِ خودِ متدِ کنترلر است.
 */
jest.mock('@nestjs/passport', () => ({
  AuthGuard: () => class {},
  PassportStrategy: class {},
}));

import { ForbiddenException } from '@nestjs/common';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { LeaveType } from '../database/entities/leave-request.entity';
import type { JwtUser } from '../common/current-user.decorator';
import { LeaveController } from './leave.controller';

const ORG = 'org-1';
const MY_PERSONNEL = 'personnel-mine';
const COLLEAGUE = 'personnel-other';

/**
 * «برای چه کسی» مرخصی ثبت می‌شود.
 *
 * قاعده در خودِ کنترلر است (نه در نگهبانِ مسیر)، چون به هدفِ درخواست
 * بستگی دارد نه به مسیر: HR باید بتواند برای پرسنل ثبت کند، ولی یک
 * ویرایشگر نباید به نامِ همکارش ثبت کند.
 */
describe('LeaveController — ثبت به نامِ دیگری', () => {
  let controller: LeaveController;
  let created: Array<Record<string, unknown>>;

  const user = (role: OrganizationRole): JwtUser => ({
    sub: 'user-1',
    email: 'a@b.c',
    organizationId: ORG,
    workspaceId: null,
    role,
  });

  const body = (personnelId: string) => ({
    personnelId,
    type: LeaveType.ANNUAL,
    fromDate: '2026-12-01',
    toDate: '2026-12-02',
  });

  beforeEach(() => {
    created = [];
    controller = new LeaveController(
      {
        create: async (
          _org: string,
          dto: Record<string, unknown>,
        ) => {
          created.push(dto);
          return { id: 'leave-1', ...dto };
        },
      } as never,
      // حسابِ آزمون به پروندهٔ «خودم» وصل است.
      { findByUser: async () => ({ id: MY_PERSONNEL }) } as never,
    );
  });

  it('ویرایشگر مرخصیِ خودش را ثبت می‌کند', async () => {
    await controller.create(ORG, body(MY_PERSONNEL) as never, user(
      OrganizationRole.EDITOR,
    ));
    expect(created).toHaveLength(1);
    expect(created[0].personnelId).toBe(MY_PERSONNEL);
  });

  it('ویرایشگر به نامِ همکار ثبت نمی‌کند', async () => {
    await expect(
      controller.create(ORG, body(COLLEAGUE) as never, user(
        OrganizationRole.EDITOR,
      )),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // و چیزی هم ثبت نمی‌شود.
    expect(created).toHaveLength(0);
  });

  it('پیامِ خطا راهِ درست را نشان می‌دهد', async () => {
    await expect(
      controller.create(ORG, body(COLLEAGUE) as never, user(
        OrganizationRole.EDITOR,
      )),
    ).rejects.toThrow('داشبورد من');
  });

  it('مدیر به نامِ همکار ثبت می‌کند (کارِ منابع انسانی)', async () => {
    await controller.create(ORG, body(COLLEAGUE) as never, user(
      OrganizationRole.ADMIN,
    ));
    expect(created[0].personnelId).toBe(COLLEAGUE);
  });

  it('مالک هم می‌تواند', async () => {
    await controller.create(ORG, body(COLLEAGUE) as never, user(
      OrganizationRole.OWNER,
    ));
    expect(created).toHaveLength(1);
  });

  it('تحلیل‌گر به نامِ همکار ثبت نمی‌کند', async () => {
    await expect(
      controller.create(ORG, body(COLLEAGUE) as never, user(
        OrganizationRole.ANALYST,
      )),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('حسابِ بی‌پروندهٔ پرسنلی به نامِ کسی ثبت نمی‌کند', async () => {
    const detached = new LeaveController(
      { create: async () => ({}) } as never,
      // هیچ پروندهٔ پرسنلی به این حساب وصل نیست.
      { findByUser: async () => null } as never,
    );
    await expect(
      detached.create(ORG, body(MY_PERSONNEL) as never, user(
        OrganizationRole.EDITOR,
      )),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('نقشِ نامعلوم مثلِ کم‌ترین نقش رفتار می‌کند', async () => {
    const noRole = { ...user(OrganizationRole.EDITOR) };
    delete noRole.role;
    await expect(
      controller.create(ORG, body(COLLEAGUE) as never, noRole),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
