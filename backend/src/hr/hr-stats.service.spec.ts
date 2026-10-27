jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import {
  PublicationEntity,
  PublicationType,
} from '../database/entities/publication.entity';
import {
  ResponseEntity,
  ResponseStatus,
} from '../database/entities/response.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { createTestDataSource } from '../testing/test-database';
import { HrService } from './hr.service';
import { HrStatsService } from './hr-stats.service';

describe('HrStatsService', () => {
  let ds: DataSource;
  let hr: HrService;
  let stats: HrStatsService;
  let n = 0;

  const seedRequest = async (orgId: string, mobile: string, review?: string) => {
    n += 1;
    const ws = await ds
      .getRepository(WorkspaceEntity)
      .save({ organizationId: orgId, name: `ws${n}` });
    const form = await ds.getRepository(FormEntity).save({
      workspaceId: ws.id,
      title: `f${n}`,
      slug: `s-${n}-${Date.now()}`,
      status: FormStatus.ACTIVE,
      settings: {},
    });
    const v = await ds
      .getRepository(FormVersionEntity)
      .save({ formId: form.id, version: 1, structure: { pages: [] } });
    const p = await ds.getRepository(PublicationEntity).save({
      formId: form.id,
      type: PublicationType.LINK,
      token: `t-${n}-${Date.now()}`,
      isActive: true,
    });
    await ds.getRepository(ResponseEntity).save({
      formVersionId: v.id,
      publicationId: p.id,
      respondentKey: mobile,
      status: ResponseStatus.COMPLETED,
      startedAt: new Date(),
      submittedAt: new Date(),
      answers: {},
      scores: {},
      meta: review ? { review: { status: review } } : {},
    });
  };

  beforeEach(async () => {
    ds = await createTestDataSource();
    hr = new HrService(ds.getRepository(PersonnelEntity));
    stats = new HrStatsService(
      ds.getRepository(PersonnelEntity),
      ds.getRepository(ResponseEntity),
    );
  });

  it('درخواست‌های هر پرسنل را بر اساسِ وضعیت می‌شمارد', async () => {
    const org = await ds.getRepository(OrganizationEntity).save({ name: 'o' });
    const a = await hr.create(org.id, { fullName: 'الف', mobile: '09120000001' });
    await hr.create(org.id, { fullName: 'ب', mobile: '09120000002' });
    await seedRequest(org.id, '09120000001', 'pending');
    await seedRequest(org.id, '09120000001', 'approved');
    await seedRequest(org.id, '09120000001', 'rejected');
    await seedRequest(org.id, '09120000001'); // بدونِ گردش‌کار

    const result = await stats.requestStats(org.id);
    expect(result).toEqual([
      { personnelId: a.id, total: 4, pending: 1, approved: 1, rejected: 1 },
    ]);
  });

  it('درخواستِ سازمانِ دیگر با همان موبایل شمرده نمی‌شود', async () => {
    const org = await ds.getRepository(OrganizationEntity).save({ name: 'o' });
    const other = await ds.getRepository(OrganizationEntity).save({ name: 'x' });
    await hr.create(org.id, { fullName: 'الف', mobile: '09120000001' });
    await seedRequest(other.id, '09120000001', 'approved');
    expect(await stats.requestStats(org.id)).toEqual([]);
  });

  it('بدونِ پرسنلِ موبایل‌دار، فهرستِ خالی', async () => {
    const org = await ds.getRepository(OrganizationEntity).save({ name: 'o' });
    await hr.create(org.id, { fullName: 'بی‌موبایل' });
    expect(await stats.requestStats(org.id)).toEqual([]);
  });
});
