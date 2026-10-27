jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { MenuEntity } from '../database/entities/menu.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { MENU_TEMPLATES } from '../templates/menu-templates';
import { createTestDataSource } from '../testing/test-database';
import { MenuService } from './menu.service';

describe('MenuService — منوی QR', () => {
  let ds: DataSource;
  let service: MenuService;
  let workspaceId: string;
  let otherWorkspaceId: string;

  beforeEach(async () => {
    ds = await createTestDataSource();
    const org = await ds
      .getRepository(OrganizationEntity)
      .save({ name: 'هتل کوروش' });
    workspaceId = (
      await ds
        .getRepository(WorkspaceEntity)
        .save({ organizationId: org.id, name: 'اصلی' })
    ).id;
    otherWorkspaceId = (
      await ds
        .getRepository(WorkspaceEntity)
        .save({ organizationId: org.id, name: 'دیگر' })
    ).id;
    service = new MenuService(ds.getRepository(MenuEntity), {
      publicFooter: () =>
        Promise.resolve({ enabled: false, text: '', url: '' }),
    } as never);
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('منوی تازه از قالب، بخش‌ها و اقلامش را می‌گیرد', async () => {
    const menu = await service.save(workspaceId, null, {
      slug: 'kourosh-room',
      templateKey: 'hotel-room-service',
    });
    expect(menu.sections.length).toBeGreaterThan(0);
    expect(menu.title).toBe('خدمات اتاق هتل');
    const names = menu.sections.flatMap((s) => s.items.map((i) => i.name));
    expect(names).toContain('چلوکباب کوبیده');
  });

  it('قیمت قالب‌ها خالی است تا عدد نمونه روی میز مهمان چاپ نشود', () => {
    const prices = MENU_TEMPLATES.flatMap((t) =>
      t.sections.flatMap((s) => s.items.map((i) => i.price)),
    );
    expect(prices.every((p) => p === '')).toBe(true);
  });

  it('هر قالب شناسه‌ی یکتا دارد و اقلامش نام دارند', () => {
    const keys = MENU_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const template of MENU_TEMPLATES) {
      const ids = template.sections.flatMap((s) => s.items.map((i) => i.id));
      expect(new Set(ids).size).toBe(ids.length);
      for (const section of template.sections) {
        expect(section.title.trim()).not.toBe('');
        for (const item of section.items) expect(item.name.trim()).not.toBe('');
      }
    }
  });

  it('نشانک تکراری و نامعتبر رد می‌شود', async () => {
    await service.save(workspaceId, null, { slug: 'cafe', title: 'کافه' });
    await expect(
      service.save(workspaceId, null, { slug: 'cafe', title: 'دوباره' }),
    ).rejects.toThrow('قبلا گرفته شده');
    await expect(
      service.save(workspaceId, null, { slug: 'بد نشانک', title: 'x' }),
    ).rejects.toThrow();
    // مسیر عمومی خود منو نباید به‌عنوان نشانک گرفته شود.
    await expect(
      service.save(workspaceId, null, { slug: 'menu', title: 'x' }),
    ).rejects.toThrow();
  });

  it('ویرایش، نشانک خودش را تکراری نمی‌شمارد', async () => {
    const menu = await service.save(workspaceId, null, {
      slug: 'cafe',
      title: 'کافه',
    });
    const updated = await service.save(workspaceId, menu.id, {
      slug: 'cafe',
      title: 'کافه‌ی لابی',
    });
    expect(updated.title).toBe('کافه‌ی لابی');
    expect(updated.id).toBe(menu.id);
  });

  it('منوی فضای کاری دیگر دیده و ویرایش نمی‌شود', async () => {
    const mine = await service.save(workspaceId, null, {
      slug: 'mine',
      title: 'مال من',
    });
    expect(await service.list(otherWorkspaceId)).toHaveLength(0);
    await expect(service.get(otherWorkspaceId, mine.id)).rejects.toThrow(
      'یافت نشد',
    );
    await expect(
      service.save(otherWorkspaceId, mine.id, { title: 'دزدیده' }),
    ).rejects.toThrow('یافت نشد');
    await expect(service.remove(otherWorkspaceId, mine.id)).rejects.toThrow(
      'یافت نشد',
    );
  });

  it('نمای عمومی، بخش و قلم بی‌نام را نشان نمی‌دهد', async () => {
    await service.save(workspaceId, null, {
      slug: 'public-menu',
      title: 'منو',
      sections: [
        {
          id: 's1',
          title: 'نوشیدنی',
          items: [
            { id: 'i1', name: 'چای', description: '', price: '۲۰ هزار' },
            { id: 'i2', name: '   ', description: '', price: '' },
          ],
        },
        { id: 's2', title: '  ', items: [] },
      ],
    });
    const view = await service.publicBySlug('public-menu');
    expect(view.sections).toHaveLength(1);
    expect(view.sections[0].items).toHaveLength(1);
    expect(view.sections[0].items[0].price).toBe('۲۰ هزار');
  });

  it('منوی خاموش برای مهمان باز نمی‌شود، ولی حذف هم نشده', async () => {
    const menu = await service.save(workspaceId, null, {
      slug: 'off-menu',
      title: 'منو',
      isActive: false,
    });
    await expect(service.publicBySlug('off-menu')).rejects.toThrow('یافت نشد');
    expect(await service.get(workspaceId, menu.id)).toBeTruthy();
  });

  it('نشانک عمومی به بزرگی و کوچکی حروف و فاصله حساس نیست', async () => {
    await service.save(workspaceId, null, { slug: 'lobby', title: 'لابی' });
    await expect(service.publicBySlug('  LOBBY ')).resolves.toMatchObject({
      title: 'لابی',
    });
  });

  it('سقف تعداد عکس و قلم رعایت می‌شود', async () => {
    await expect(
      service.save(workspaceId, null, {
        slug: 'many',
        title: 'x',
        images: Array.from({ length: 31 }, (_, i) => `/uploads/${i}.png`),
      }),
    ).rejects.toThrow('عکس');
  });

  describe('ظاهر و تعویضِ قالب', () => {
    it('ظاهرِ پیش‌فرض کلاسیک است و قابل تغییر', async () => {
      const menu = await service.save(workspaceId, null, { slug: 'lobby' });
      expect(menu.theme).toBe('classic');
      const updated = await service.save(workspaceId, menu.id, {
        theme: 'gold',
      });
      expect(updated.theme).toBe('gold');
      const pub = await service.publicBySlug('lobby');
      expect(pub.theme).toBe('gold');
    });

    it('ظاهرِ ناشناخته رد می‌شود', async () => {
      const menu = await service.save(workspaceId, null, { slug: 'cafe1' });
      await expect(
        service.save(workspaceId, menu.id, { theme: 'neon-pink' }),
      ).rejects.toThrow('ظاهر');
    });

    it('قالبِ محتوا روی منوی موجود بخش‌ها را جایگزین می‌کند و عنوان می‌ماند', async () => {
      const menu = await service.save(workspaceId, null, {
        slug: 'room',
        title: 'منوی اتاقِ کوروش',
      });
      const template = MENU_TEMPLATES.find((t) =>
        t.sections.some((s) => s.items.length > 0),
      )!;
      const updated = await service.save(workspaceId, menu.id, {
        templateKey: template.key,
      });
      expect(updated.title).toBe('منوی اتاقِ کوروش');
      expect(updated.sections.length).toBe(template.sections.length);
    });
  });
});
