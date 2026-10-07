jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { PortalService } from './portal.service';
import { FormStatus } from '../database/entities/form.entity';
import { PublicationType } from '../database/entities/publication.entity';

type Row = Record<string, unknown>;

/**
 * مخزن‌های ساختگی با فیلتر واقعی روی `In` و برابری ساده.
 *
 * فیلتر واقعی لازم است: تست‌های اینجا دقیقا درباره‌ی «چه چیزی فیلتر
 * می‌شود» هستند، و مخزنی که همه‌چیز را برمی‌گرداند چیزی را ثابت نمی‌کند.
 */
function repo(rows: Row[]) {
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([key, value]) => {
      const v = value as { _type?: string; _value?: unknown[] };
      if (v && typeof v === 'object' && v._type === 'in') {
        return (v._value ?? []).includes(row[key]);
      }
      return row[key] === value;
    });

  return {
    find: async (options?: { where?: Row }) =>
      options?.where ? rows.filter((r) => matches(r, options.where!)) : rows,
    findOne: async (options?: { where?: Row }) =>
      (options?.where
        ? rows.filter((r) => matches(r, options.where!))
        : rows)[0] ?? null,
    count: async (options?: { where?: Row }) =>
      (options?.where ? rows.filter((r) => matches(r, options.where!)) : rows)
        .length,
    create: (v: Row) => v,
    save: async (v: Row) => v,
    delete: async () => undefined,
  } as never;
}

const PORTAL = {
  id: 'p1',
  workspaceId: 'w1',
  slug: 'hotel',
  title: 'نظرسنجی‌های هتل',
  description: '',
  logoUrl: '',
  formIds: ['f1', 'f2'],
  isActive: true,
};

const tenant = { assertWorkspace: async () => undefined } as never;

const platform = {
  isSuperAdmin: async () => false,
  publicFooter: async () => ({ enabled: false, text: '', url: null }),
} as never;

/** پلن نامحدود؛ سقف پرتال جای دیگری آزموده می‌شود. */
const plans = {
  organizationOfWorkspace: () => Promise.resolve('org-1'),
  assertQuota: () => Promise.resolve(),
} as never;

describe('PortalService', () => {
  describe('نمای عمومی', () => {
    const build = (over: {
      portal?: Row | null;
      forms?: Row[];
      publications?: Row[];
    }) =>
      new PortalService(
        repo(over.portal === null ? [] : [over.portal ?? PORTAL]),
        repo(over.forms ?? []),
        repo(over.publications ?? []),
        platform,
        tenant,
        plans,
      );

    it('فقط فرم فعالِ منتشرشده را می‌آورد', async () => {
      const service = build({
        forms: [
          { id: 'f1', title: 'فرم یک', status: FormStatus.ACTIVE },
          { id: 'f2', title: 'فرم دو', status: FormStatus.ACTIVE },
        ],
        publications: [
          {
            formId: 'f1',
            token: 'tok1',
            slug: null,
            type: PublicationType.LINK,
            isActive: true,
          },
        ],
      });

      const result = await service.publicBySlug('hotel');
      // فرم دو منتشر نشده؛ کارتی که به هیچ‌جا نمی‌رود نباید ساخته شود.
      expect(result.forms.map((f) => f.formId)).toEqual(['f1']);
      expect(result.forms[0].url).toBe('/f/tok1');
    });

    it('ترتیب انتخاب کاربر حفظ می‌شود', async () => {
      const service = build({
        portal: { ...PORTAL, formIds: ['f2', 'f1'] },
        forms: [
          { id: 'f1', title: 'فرم یک', status: FormStatus.ACTIVE },
          { id: 'f2', title: 'فرم دو', status: FormStatus.ACTIVE },
        ],
        publications: [
          {
            formId: 'f1',
            token: 't1',
            slug: null,
            type: PublicationType.LINK,
            isActive: true,
          },
          {
            formId: 'f2',
            token: 't2',
            slug: null,
            type: PublicationType.LINK,
            isActive: true,
          },
        ],
      });

      const result = await service.publicBySlug('hotel');
      expect(result.forms.map((f) => f.formId)).toEqual(['f2', 'f1']);
    });

    it('نشانی اختصاصی بر توکن تصادفی ترجیح دارد', async () => {
      const service = build({
        portal: { ...PORTAL, formIds: ['f1'] },
        forms: [{ id: 'f1', title: 'فرم', status: FormStatus.ACTIVE }],
        publications: [
          {
            formId: 'f1',
            token: 'tok',
            slug: 'nazarsanji',
            type: PublicationType.LINK,
            isActive: true,
          },
        ],
      });
      expect((await service.publicBySlug('hotel')).forms[0].url).toBe(
        '/f/nazarsanji',
      );
    });

    it('پرتال غیرفعال یافت نمی‌شود', async () => {
      const service = build({ portal: { ...PORTAL, isActive: false } });
      await expect(service.publicBySlug('hotel')).rejects.toThrow(
        'پرتال یافت نشد',
      );
    });

    it('نشانک با فاصله و حروف بزرگ هم پیدا می‌شود', async () => {
      const service = build({ forms: [], publications: [] });
      await expect(service.publicBySlug('  HOTEL ')).resolves.toBeDefined();
    });
  });

  describe('ذخیره', () => {
    it('فرم سازمان دیگر از فهرست حذف می‌شود', async () => {
      /*
       * بدون این فیلتر می‌شد شناسه‌ی فرم سازمان دیگری را در فهرست گذاشت و
       * آن را روی پرتال خودی عمومی کرد.
       */
      const service = new PortalService(
        repo([]),
        repo([{ id: 'mine', workspaceId: 'w1' }]),
        repo([]),
        platform,
        tenant,
        plans,
      );

      const saved = await service.save('w1', null, {
        slug: 'hotel',
        title: 'پرتال',
        formIds: ['mine', 'someone-elses'],
      });

      expect(saved.formIds).toEqual(['mine']);
    });

    it('نشانک رزروشده رد می‌شود', async () => {
      const service = new PortalService(
        repo([]),
        repo([]),
        repo([]),
        platform,
        tenant,
        plans,
      );
      await expect(
        service.save('w1', null, { slug: 'panel', title: 'x' }),
      ).rejects.toThrow('رزرو شده');
    });

    it('نشانک تکراری رد می‌شود', async () => {
      const service = new PortalService(
        repo([{ id: 'other', slug: 'hotel' }]),
        repo([]),
        repo([]),
        platform,
        tenant,
        plans,
      );
      await expect(
        service.save('w1', null, { slug: 'hotel', title: 'x' }),
      ).rejects.toThrow('قبلا گرفته شده');
    });
  });
});
