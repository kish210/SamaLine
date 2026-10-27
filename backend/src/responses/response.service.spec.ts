jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { PublicationEntity, PublicationType } from '../database/entities/publication.entity';
import { ResponseCommentEntity } from '../database/entities/response-comment.entity';
import {
  ResponseEntity,
  ResponseStatus,
} from '../database/entities/response.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { createTestDataSource } from '../testing/test-database';
import { ResponseService } from './response.service';

describe('ResponseService — کارتابلِ تأیید (فاز H)', () => {
  let ds: DataSource;
  let service: ResponseService;
  let workspaceId: string;
  let counter = 0;

  const svc = () =>
    new ResponseService(
      ds.getRepository(ResponseEntity),
      ds.getRepository(FormEntity),
      ds.getRepository(ResponseCommentEntity),
      { notifyReviewDecision: async () => {} } as never,
    );

  /** یک فرم + نسخه + انتشار + یک پاسخ با وضعیتِ بررسیِ دلخواه می‌سازد. */
  const seedResponse = async (opts: {
    requiresApproval: boolean;
    reviewStatus?: 'pending' | 'approved';
    departmentId?: string | null;
    title?: string;
  }) => {
    counter += 1;
    const form = await ds.getRepository(FormEntity).save({
      workspaceId,
      title: opts.title ?? `فرم ${counter}`,
      slug: `form-${counter}-${Date.now()}`,
      status: FormStatus.ACTIVE,
      departmentId: opts.departmentId ?? null,
      settings: opts.requiresApproval ? { requiresApproval: true } : {},
    });
    const version = await ds.getRepository(FormVersionEntity).save({
      formId: form.id,
      version: 1,
      structure: { pages: [] },
    });
    const publication = await ds.getRepository(PublicationEntity).save({
      formId: form.id,
      type: PublicationType.LINK,
      token: `tok-${counter}-${Date.now()}`,
      isActive: true,
    });
    await ds.getRepository(ResponseEntity).save({
      formVersionId: version.id,
      publicationId: publication.id,
      respondentKey: '09120000000',
      status: ResponseStatus.COMPLETED,
      startedAt: new Date(),
      submittedAt: new Date(),
      answers: {},
      scores: {},
      meta: opts.reviewStatus
        ? { review: { status: opts.reviewStatus, requestedAt: '2026-01-01T00:00:00Z' } }
        : {},
    });
    return form;
  };

  beforeEach(async () => {
    ds = await createTestDataSource();
    const org = await ds
      .getRepository(OrganizationEntity)
      .save({ name: 'سازمان' });
    const ws = await ds
      .getRepository(WorkspaceEntity)
      .save({ organizationId: org.id, name: 'فضا' });
    workspaceId = ws.id;
    service = svc();
  });

  const managerScope = { isManager: true, departmentIds: [] as string[] };

  it('فقط درخواست‌های معلقِ فرم‌های نیازمندِ تأیید را می‌دهد', async () => {
    await seedResponse({ requiresApproval: true, reviewStatus: 'pending', title: 'مرخصی' });
    await seedResponse({ requiresApproval: true, reviewStatus: 'approved' }); // تأییدشده
    await seedResponse({ requiresApproval: false, reviewStatus: 'pending' }); // فرمِ عادی
    await seedResponse({ requiresApproval: true }); // بدونِ بررسی

    const result = await service.pendingReviews(workspaceId, managerScope);
    expect(result).toHaveLength(1);
    expect(result[0].formTitle).toBe('مرخصی');
    expect(result[0].requestedAt).toBe('2026-01-01T00:00:00Z');
  });

  it('غیرمدیر فقط درخواست‌های بخش‌های خودش را می‌بیند', async () => {
    await seedResponse({
      requiresApproval: true,
      reviewStatus: 'pending',
      departmentId: 'dept-1',
      title: 'فنی',
    });
    await seedResponse({
      requiresApproval: true,
      reviewStatus: 'pending',
      departmentId: 'dept-2',
      title: 'خانه‌داری',
    });

    const inDept1 = await service.pendingReviews(workspaceId, {
      isManager: false,
      departmentIds: ['dept-1'],
    });
    expect(inDept1.map((r) => r.formTitle)).toEqual(['فنی']);
  });

  it('مدیر درخواست‌های همهٔ بخش‌ها را می‌بیند', async () => {
    await seedResponse({ requiresApproval: true, reviewStatus: 'pending', departmentId: 'dept-1' });
    await seedResponse({ requiresApproval: true, reviewStatus: 'pending', departmentId: 'dept-2' });
    const all = await service.pendingReviews(workspaceId, managerScope);
    expect(all).toHaveLength(2);
  });

  it('وقتی چیزی معلق نیست، فهرستِ خالی می‌دهد', async () => {
    await seedResponse({ requiresApproval: true, reviewStatus: 'approved' });
    expect(await service.pendingReviews(workspaceId, managerScope)).toEqual([]);
  });

  it('شمارِ معلق‌ها را برای نشانِ منو می‌دهد', async () => {
    await seedResponse({ requiresApproval: true, reviewStatus: 'pending' });
    await seedResponse({ requiresApproval: true, reviewStatus: 'pending' });
    await seedResponse({ requiresApproval: true, reviewStatus: 'approved' });
    expect(await service.pendingReviewCount(workspaceId, managerScope)).toEqual({
      count: 2,
    });
  });
});
