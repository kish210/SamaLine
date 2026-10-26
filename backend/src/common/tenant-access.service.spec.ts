jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { TenantAccessService } from './tenant-access.service';
import type { JwtUser } from './current-user.decorator';
import { OrganizationRole } from '../database/entities/organization-user.entity';

const USER: JwtUser = {
  sub: 'u1',
  email: 'a@b.c',
  organizationId: 'org-1',
  workspaceId: 'w1',
};

function build(options: {
  workspace?: { id: string; organizationId: string } | null;
  form?: {
    id: string;
    departmentId?: string | null;
    workspace?: { organizationId: string };
  } | null;
  publication?: { id: string; formId: string } | null;
  superAdmin?: boolean;
  /** بخش‌هایی که کاربرِ آزمون عضوشان است. */
  memberOf?: string[];
}) {
  return new TenantAccessService(
    { findOne: async () => options.workspace ?? null } as never,
    { findOne: async () => options.form ?? null } as never,
    { findOne: async () => options.publication ?? null } as never,
    { isSuperAdmin: async () => options.superAdmin ?? false } as never,
    {
      find: async () =>
        (options.memberOf ?? []).map((departmentId) => ({ departmentId })),
    } as never,
  );
}

describe('TenantAccessService', () => {
  describe('فضای کاری', () => {
    it('فضای کاری سازمان خودی پذیرفته می‌شود', async () => {
      const service = build({
        workspace: { id: 'w1', organizationId: 'org-1' },
      });
      await expect(
        service.assertWorkspace('w1', USER),
      ).resolves.toBeUndefined();
    });

    it('فضای کاری سازمان دیگر رد می‌شود', async () => {
      /*
       * شناسه از خود درخواست می‌آید؛ بدون این بررسی هر کاربر واردشده با
       * حدس زدن یک UUID می‌توانست داده‌ی سازمان دیگری را بخواند.
       */
      const service = build({
        workspace: { id: 'w9', organizationId: 'org-2' },
      });
      await expect(service.assertWorkspace('w9', USER)).rejects.toThrow(
        'به این فضای کاری دسترسی ندارید',
      );
    });

    it('فضای کاری ناموجود رد می‌شود', async () => {
      const service = build({ workspace: null });
      await expect(service.assertWorkspace('نیست', USER)).rejects.toThrow(
        'به این فضای کاری دسترسی ندارید',
      );
    });

    it('سوپرادمین به همه‌ی فضاهای کاری دسترسی دارد', async () => {
      const service = build({
        workspace: { id: 'w9', organizationId: 'org-2' },
        superAdmin: true,
      });
      await expect(
        service.assertWorkspace('w9', USER),
      ).resolves.toBeUndefined();
    });
  });

  describe('فرم', () => {
    it('فرم سازمان خودی پذیرفته می‌شود و برمی‌گردد', async () => {
      const service = build({
        form: { id: 'f1', workspace: { organizationId: 'org-1' } },
      });
      const form = await service.assertForm('f1', USER);
      expect(form.id).toBe('f1');
    });

    it('فرم سازمان دیگر رد می‌شود', async () => {
      const service = build({
        form: { id: 'f9', workspace: { organizationId: 'org-2' } },
      });
      await expect(service.assertForm('f9', USER)).rejects.toThrow(
        'به این فرم دسترسی ندارید',
      );
    });

    /*
     * فرمِ بخشی: هر دو کاربر در یک سازمان‌اند، پس بررسی سازمانی ردشان
     * نمی‌کند. چیزی که باید جلویشان را بگیرد، عضو نبودن در آن بخش است.
     */
    it('فرمِ بخشی برای عضوِ همان بخش باز است', async () => {
      const service = build({
        form: {
          id: 'f1',
          departmentId: 'dept-fani',
          workspace: { organizationId: 'org-1' },
        },
        memberOf: ['dept-fani'],
      });
      const form = await service.assertForm('f1', USER);
      expect(form.id).toBe('f1');
    });

    it('فرمِ بخشی برای کسی که عضو آن بخش نیست رد می‌شود', async () => {
      const service = build({
        form: {
          id: 'f1',
          departmentId: 'dept-fani',
          workspace: { organizationId: 'org-1' },
        },
        memberOf: ['dept-housekeeping'],
      });
      await expect(service.assertForm('f1', USER)).rejects.toThrow(
        'عضو آن نیستید',
      );
    });

    it('مدیر سازمان به فرمِ هر بخشی دسترسی دارد', async () => {
      const service = build({
        form: {
          id: 'f1',
          departmentId: 'dept-fani',
          workspace: { organizationId: 'org-1' },
        },
        memberOf: [],
      });
      const form = await service.assertForm('f1', {
        ...USER,
        role: OrganizationRole.ADMIN,
      });
      expect(form.id).toBe('f1');
    });

    it('فرم بدون بخش (نظرسنجی عمومی) برای همه‌ی اعضای سازمان باز است', async () => {
      const service = build({
        form: {
          id: 'f1',
          departmentId: null,
          workspace: { organizationId: 'org-1' },
        },
        memberOf: [],
      });
      const form = await service.assertForm('f1', USER);
      expect(form.id).toBe('f1');
    });

    it('فرم ناموجود «یافت نشد» می‌دهد نه «دسترسی ندارید»', async () => {
      const service = build({ form: null });
      await expect(service.assertForm('نیست', USER)).rejects.toThrow(
        'فرم یافت نشد',
      );
    });

    it('فرم بدون فضای کاری رد می‌شود، نه اینکه از بررسی بگذرد', async () => {
      // داده‌ی ناقص نباید به «مالکیت تاییدشده» تعبیر شود.
      const service = build({ form: { id: 'f1' } });
      await expect(service.assertForm('f1', USER)).rejects.toThrow(
        'به این فرم دسترسی ندارید',
      );
    });

    it('سوپرادمین به همه‌ی فرم‌ها دسترسی دارد', async () => {
      const service = build({
        form: { id: 'f9', workspace: { organizationId: 'org-2' } },
        superAdmin: true,
      });
      await expect(service.assertForm('f9', USER)).resolves.toBeDefined();
    });
  });

  describe('انتشار', () => {
    it('انتشارِ فرم سازمان خودی پذیرفته می‌شود', async () => {
      const service = build({
        publication: { id: 'p1', formId: 'f1' },
        form: { id: 'f1', workspace: { organizationId: 'org-1' } },
      });
      await expect(service.assertPublication('p1', USER)).resolves.toEqual({
        id: 'p1',
        formId: 'f1',
      });
    });

    it('انتشارِ فرم سازمان دیگر رد می‌شود', async () => {
      // بدون این، هر کاربری می‌توانست به نام سازمان دیگر کمپین بفرستد.
      const service = build({
        publication: { id: 'p9', formId: 'f9' },
        form: { id: 'f9', workspace: { organizationId: 'org-2' } },
      });
      await expect(service.assertPublication('p9', USER)).rejects.toThrow(
        'به این فرم دسترسی ندارید',
      );
    });

    it('انتشار ناموجود یا شناسه‌ی خالی رد می‌شود', async () => {
      const service = build({ publication: null });
      await expect(service.assertPublication('', USER)).rejects.toThrow(
        'انتشار یافت نشد',
      );
      await expect(service.assertPublication('x', USER)).rejects.toThrow(
        'انتشار یافت نشد',
      );
    });
  });
});
