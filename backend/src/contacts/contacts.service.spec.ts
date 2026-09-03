jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
  getRepositoryToken: (entity: unknown) => entity,
  TypeOrmModule: { forFeature: () => ({}), forRoot: () => ({}) },
}));

import type { DataSource } from 'typeorm';
import { ContactEntity } from '../database/entities/contact.entity';
import { ContactListEntity } from '../database/entities/contact-list.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { createTestDataSource } from '../testing/test-database';
import { ContactsService } from './contacts.service';

describe('ContactsService — دفترچه مخاطبان', () => {
  let ds: DataSource;
  let service: ContactsService;
  let organizationId: string;
  let otherOrganizationId: string;
  let listId: string;

  beforeEach(async () => {
    ds = await createTestDataSource();
    service = new ContactsService(
      ds.getRepository(ContactListEntity),
      ds.getRepository(ContactEntity),
    );

    const orgRepo = ds.getRepository(OrganizationEntity);
    organizationId = (await orgRepo.save({ name: 'سازمان الف' })).id;
    otherOrganizationId = (await orgRepo.save({ name: 'سازمان ب' })).id;

    const list = await service.createList(organizationId, {
      name: 'مشتریان',
    });
    listId = list.id;
  });

  afterEach(async () => {
    await ds.destroy();
  });

  describe('جداسازی مستاجر', () => {
    it('فهرست سازمان دیگر قابل خواندن نیست', async () => {
      await expect(
        service.listContacts(otherOrganizationId, listId),
      ).rejects.toThrow('فهرست مخاطبان یافت نشد');
    });

    it('فهرست‌ها فقط برای سازمان خودشان دیده می‌شوند', async () => {
      await service.createList(otherOrganizationId, { name: 'دیگری' });
      const lists = await service.listLists(organizationId);
      expect(lists.map((l) => l.name)).toEqual(['مشتریان']);
    });
  });

  describe('addContacts', () => {
    it('مخاطب جدید اضافه می‌کند', async () => {
      const result = await service.addContacts(organizationId, listId, {
        contacts: [
          { fullName: 'مریم', mobile: '09120000001' },
          { fullName: 'علی', email: 'ali@test.local' },
        ],
      });

      expect(result).toMatchObject({ created: 2, updated: 0 });
      expect(await service.listContacts(organizationId, listId)).toHaveLength(
        2,
      );
    });

    it('مخاطب تکراری بر اساس موبایل را به‌روزرسانی می‌کند نه تکرار', async () => {
      await service.addContacts(organizationId, listId, {
        contacts: [{ fullName: 'مریم', mobile: '09120000001' }],
      });
      const second = await service.addContacts(organizationId, listId, {
        contacts: [
          {
            fullName: 'مریم رضایی',
            mobile: '09120000001',
            variables: { شهر: 'تهران' },
          },
        ],
      });

      expect(second).toMatchObject({ created: 0, updated: 1 });
      const contacts = await service.listContacts(organizationId, listId);
      expect(contacts).toHaveLength(1);
      expect(contacts[0].fullName).toBe('مریم رضایی');
      expect(contacts[0].variables).toEqual({ شهر: 'تهران' });
    });

    it('ایمیل را برای تشخیص تکرار یکسان‌سازی می‌کند', async () => {
      await service.addContacts(organizationId, listId, {
        contacts: [{ email: 'Ali@Test.Local' }],
      });
      const second = await service.addContacts(organizationId, listId, {
        contacts: [{ email: 'ali@test.local' }],
      });

      expect(second.updated).toBe(1);
      expect(await service.listContacts(organizationId, listId)).toHaveLength(
        1,
      );
    });

    it('مخاطب بدون موبایل و ایمیل را رد می‌کند', async () => {
      const result = await service.addContacts(organizationId, listId, {
        contacts: [{ fullName: 'بی‌نشانی' }],
      });

      expect(result.created).toBe(0);
      expect(result.skipped).toEqual(['بی‌نشانی']);
    });

    it('در فهرست سازمان دیگر مخاطب اضافه نمی‌کند', async () => {
      await expect(
        service.addContacts(otherOrganizationId, listId, {
          contacts: [{ mobile: '09120000009' }],
        }),
      ).rejects.toThrow('فهرست مخاطبان یافت نشد');
    });
  });

  describe('لغو اشتراک', () => {
    it('مخاطب لغو اشتراک‌کرده در فهرست پیش‌فرض نمی‌آید', async () => {
      await service.addContacts(organizationId, listId, {
        contacts: [{ fullName: 'مریم', mobile: '09120000001' }],
      });
      const [contact] = await service.listContacts(organizationId, listId);

      await service.unsubscribe(organizationId, listId, contact.id);

      expect(await service.listContacts(organizationId, listId)).toHaveLength(
        0,
      );
      expect(
        await service.listContacts(organizationId, listId, true),
      ).toHaveLength(1);
    });

    it('مخاطب لغو اشتراک‌کرده گیرنده‌ی کمپین نمی‌شود', async () => {
      await service.addContacts(organizationId, listId, {
        contacts: [
          { fullName: 'مریم', mobile: '09120000001' },
          { fullName: 'علی', mobile: '09120000002' },
        ],
      });
      const contacts = await service.listContacts(organizationId, listId);
      await service.unsubscribe(organizationId, listId, contacts[0].id);

      const recipients = await service.campaignRecipients(
        organizationId,
        listId,
        'sms',
      );
      expect(recipients).toHaveLength(1);
    });
  });

  describe('campaignRecipients', () => {
    it('برای کانال پیامک فقط مخاطبان دارای موبایل را می‌دهد', async () => {
      await service.addContacts(organizationId, listId, {
        contacts: [
          { fullName: 'مریم', mobile: '09120000001' },
          { fullName: 'علی', email: 'ali@test.local' },
        ],
      });

      const sms = await service.campaignRecipients(
        organizationId,
        listId,
        'sms',
      );
      expect(sms).toEqual([{ to: '09120000001', variables: { name: 'مریم' } }]);
    });

    it('برای کانال ایمیل فقط مخاطبان دارای ایمیل را می‌دهد', async () => {
      await service.addContacts(organizationId, listId, {
        contacts: [
          { fullName: 'مریم', mobile: '09120000001' },
          { fullName: 'علی', email: 'ali@test.local' },
        ],
      });

      const email = await service.campaignRecipients(
        organizationId,
        listId,
        'email',
      );
      expect(email).toEqual([
        { to: 'ali@test.local', variables: { name: 'علی' } },
      ]);
    });

    it('متغیرهای دلخواه مخاطب را برای شخصی‌سازی می‌فرستد', async () => {
      await service.addContacts(organizationId, listId, {
        contacts: [
          {
            fullName: 'مریم',
            mobile: '09120000001',
            variables: { branch: 'تهران' },
          },
        ],
      });

      const [recipient] = await service.campaignRecipients(
        organizationId,
        listId,
        'sms',
      );
      expect(recipient.variables).toEqual({ branch: 'تهران', name: 'مریم' });
    });
  });

  describe('parseCsv', () => {
    it('خطوط CSV را به مخاطب تبدیل می‌کند', () => {
      expect(
        ContactsService.parseCsv(
          'مریم,09120000001,m@t.local\nعلی,09120000002,',
        ),
      ).toEqual([
        { fullName: 'مریم', mobile: '09120000001', email: 'm@t.local' },
        { fullName: 'علی', mobile: '09120000002', email: undefined },
      ]);
    });

    it('خطوط خالی را نادیده می‌گیرد', () => {
      expect(ContactsService.parseCsv('مریم,0912\n\n\n')).toHaveLength(1);
    });

    it('ورودی خالی را رد می‌کند', () => {
      expect(() => ContactsService.parseCsv('   ')).toThrow('فایل خالی است');
    });
  });

  describe('حذف', () => {
    it('حذف فهرست، مخاطبانش را هم حذف می‌کند', async () => {
      await service.addContacts(organizationId, listId, {
        contacts: [{ mobile: '09120000001' }],
      });

      await service.removeList(organizationId, listId);

      expect(await ds.getRepository(ContactEntity).count()).toBe(0);
    });

    it('حذف مخاطب ناموجود خطا می‌دهد', async () => {
      await expect(
        service.removeContact(
          organizationId,
          listId,
          '00000000-0000-0000-0000-000000000000',
        ),
      ).rejects.toThrow('مخاطب یافت نشد');
    });
  });
});
