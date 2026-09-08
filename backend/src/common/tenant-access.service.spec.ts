jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { TenantAccessService } from './tenant-access.service';
import type { JwtUser } from './current-user.decorator';

const USER: JwtUser = {
  sub: 'u1',
  email: 'a@b.c',
  organizationId: 'org-1',
  workspaceId: 'w1',
};

function build(options: {
  workspace?: { id: string; organizationId: string } | null;
  form?: { id: string; workspace?: { organizationId: string } } | null;
  superAdmin?: boolean;
}) {
  return new TenantAccessService(
    { findOne: async () => options.workspace ?? null } as never,
    { findOne: async () => options.form ?? null } as never,
    { isSuperAdmin: async () => options.superAdmin ?? false } as never,
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
});
