import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { PortalEntity } from '../database/entities/portal.entity';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import {
  PublicationEntity,
  PublicationType,
} from '../database/entities/publication.entity';
import { TenantAccessService } from '../common/tenant-access.service';
import { PlatformSettingsService } from '../platform/platform-settings.service';
import { validateSlug } from '../forms/slug';

export interface PortalInput {
  slug?: string;
  title?: string;
  description?: string;
  formIds?: string[];
  logoUrl?: string;
  isActive?: boolean;
}

/**
 * پرتال: چند فرم روی یک صفحه‌ی عمومی.
 *
 * فهرست فرم‌ها صریح است. نسخه‌ی قبلی هر انتشار فعالِ سازمان را روی پرتال
 * می‌آورد، یعنی لینکی که برای استفاده‌ی داخلی ساخته شده بود هم عمومی
 * می‌شد — و نشانی پرتال شناسه‌ی سازمان بود، که هم نشتی است هم زشت.
 */
@Injectable()
export class PortalService {
  constructor(
    @InjectRepository(PortalEntity)
    private readonly portalRepo: Repository<PortalEntity>,
    @InjectRepository(FormEntity)
    private readonly formRepo: Repository<FormEntity>,
    @InjectRepository(PublicationEntity)
    private readonly publicationRepo: Repository<PublicationEntity>,
    private readonly platformSettings: PlatformSettingsService,
    private readonly tenant: TenantAccessService,
  ) {}

  /** بررسی مالکیت فضای کاری؛ پیاده‌سازی مشترک در TenantAccessService است. */
  assertAccess(
    workspaceId: string,
    user: { sub: string; organizationId: string },
  ): Promise<void> {
    return this.tenant.assertWorkspace(workspaceId, user as never);
  }

  list(workspaceId: string) {
    return this.portalRepo.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async save(workspaceId: string, id: string | null, input: PortalInput) {
    const existing = id
      ? await this.portalRepo.findOne({ where: { id, workspaceId } })
      : null;
    if (id && !existing) throw new NotFoundException('پرتال یافت نشد');

    // همان اعتبارسنجی لینک اختصاصی فرم‌ها؛ دو قاعده‌ی موازی با هم واگرا می‌شوند.
    const check = validateSlug(input.slug ?? existing?.slug ?? '');
    if (!check.valid) throw new BadRequestException(check.reason ?? 'نشانی نامعتبر');
    const slug = check.normalized;

    const clash = await this.portalRepo.findOne({
      where: existing ? { slug, id: Not(existing.id) } : { slug },
    });
    if (clash) throw new BadRequestException('این نشانی قبلا گرفته شده است');

    /*
     * فرم‌ها باید متعلق به همین فضای کاری باشند.
     *
     * بدون این بررسی می‌شد شناسه‌ی فرم سازمان دیگری را در فهرست گذاشت و
     * آن را روی پرتال خودی عمومی کرد.
     */
    const formIds = await this.filterOwnForms(
      workspaceId,
      input.formIds ?? existing?.formIds ?? [],
    );

    const row = this.portalRepo.create({
      ...existing,
      workspaceId,
      slug,
      title: input.title ?? existing?.title ?? 'فرم‌های ما',
      description: input.description ?? existing?.description ?? '',
      logoUrl: input.logoUrl ?? existing?.logoUrl ?? '',
      formIds,
      isActive: input.isActive ?? existing?.isActive ?? true,
    });

    return this.portalRepo.save(row);
  }

  async remove(workspaceId: string, id: string) {
    await this.portalRepo.delete({ id, workspaceId });
    return { ok: true };
  }

  private async filterOwnForms(workspaceId: string, formIds: string[]) {
    if (formIds.length === 0) return [];
    const owned = await this.formRepo.find({
      where: { id: In(formIds), workspaceId },
    });
    const allowed = new Set(owned.map((f) => f.id));
    // ترتیب انتخاب کاربر حفظ می‌شود؛ ترتیب پرس‌وجو معنایی ندارد.
    return formIds.filter((id) => allowed.has(id));
  }

  // ── نمای عمومی ────────────────────────────────────────────────────────

  /**
   * پرتال عمومی با نشانک.
   *
   * فقط فرم‌های فعالِ منتشرشده برمی‌گردند: فرمی که در فهرست هست ولی هنوز
   * لینک ندارد، کارتی می‌شد که به هیچ‌جا نمی‌رود.
   */
  async publicBySlug(slug: string) {
    const portal = await this.portalRepo.findOne({
      where: { slug: slug.trim().toLowerCase(), isActive: true },
    });
    if (!portal) throw new NotFoundException('پرتال یافت نشد');

    const forms = await this.formRepo.find({
      where: {
        id: In(portal.formIds.length ? portal.formIds : ['-']),
        status: FormStatus.ACTIVE,
      },
    });

    const publications = await this.publicationRepo.find({
      where: {
        formId: In(forms.length ? forms.map((f) => f.id) : ['-']),
        type: PublicationType.LINK,
        isActive: true,
      },
    });

    const tokenOf = new Map(publications.map((p) => [p.formId, p]));
    const byId = new Map(forms.map((f) => [f.id, f]));

    const items = portal.formIds
      .map((id) => ({ form: byId.get(id), publication: tokenOf.get(id) }))
      .filter(
        (
          entry,
        ): entry is { form: FormEntity; publication: PublicationEntity } =>
          Boolean(entry.form && entry.publication),
      )
      .map(({ form, publication }) => ({
        formId: form.id,
        title: form.title,
        token: publication.token,
        slug: publication.slug,
        url: `/f/${publication.slug ?? publication.token}`,
      }));

    return {
      title: portal.title,
      description: portal.description,
      logoUrl: portal.logoUrl,
      forms: items,
      // نوار پایین سکو روی پرتال هم دیده می‌شود، مثل خود فرم‌ها.
      footer: await this.platformSettings.publicFooter(),
    };
  }
}
