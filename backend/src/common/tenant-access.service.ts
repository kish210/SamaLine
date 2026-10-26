import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DepartmentMemberEntity } from '../database/entities/department-member.entity';
import { FormEntity } from '../database/entities/form.entity';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { PlatformSettingsService } from '../platform/platform-settings.service';
import type { JwtUser } from './current-user.decorator';

/**
 * جداسازی مستاجرها: آیا این کاربر به این فضای کاری یا فرم دسترسی دارد؟
 *
 * شناسه‌ی فضای کاری و فرم از خودِ درخواست می‌آیند (query یا param). بدون
 * بررسی مالکیت، هر کاربر واردشده می‌تواند با حدس زدن یک شناسه، فرم‌ها و
 * پاسخ‌های سازمان دیگری را بخواند — چیزی که توکن او هرگز اجازه‌اش را
 * نداده است.
 *
 * منبع معتبر هویت فقط توکن است؛ `organizationId` هیچ‌وقت از بدنه یا
 * پارامتر خوانده نمی‌شود.
 */
@Injectable()
export class TenantAccessService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepo: Repository<WorkspaceEntity>,
    @InjectRepository(FormEntity)
    private readonly formRepo: Repository<FormEntity>,
    @InjectRepository(PublicationEntity)
    private readonly publicationRepo: Repository<PublicationEntity>,
    private readonly platformSettings: PlatformSettingsService,
    @InjectRepository(DepartmentMemberEntity)
    private readonly deptMembers: Repository<DepartmentMemberEntity>,
  ) {}

  /** مالک/مدیر سازمان به همه‌ی بخش‌ها دسترسی دارد. */
  isManager(user: JwtUser): boolean {
    return (
      user.role === OrganizationRole.OWNER ||
      user.role === OrganizationRole.ADMIN
    );
  }

  /** شناسه‌ی بخش‌هایی که کاربر عضوشان است. */
  async memberDepartmentIds(userId: string): Promise<string[]> {
    const rows = await this.deptMembers.find({
      where: { userId },
      select: { departmentId: true },
    });
    return rows.map((row) => row.departmentId);
  }

  /** فضای کاری باید متعلق به سازمان کاربر باشد. */
  async assertWorkspace(workspaceId: string, user: JwtUser): Promise<void> {
    // بدون این، شناسه‌ی جاافتاده به‌جای پیام روشن خطای ۵۰۰ می‌داد.
    if (!workspaceId)
      throw new BadRequestException('شناسه‌ی فضای کاری لازم است');
    if (await this.isSuperAdmin(user)) return;

    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });
    if (!workspace || workspace.organizationId !== user.organizationId) {
      throw new ForbiddenException('به این فضای کاری دسترسی ندارید');
    }
  }

  /**
   * فرم باید در فضای کاریِ سازمان کاربر باشد.
   *
   * فرم ناموجود «یافت نشد» می‌دهد و فرم سازمان دیگر «دسترسی ندارید».
   * تفاوت این دو پیام عمدی است: پنهان کردن وجود یا نبود یک شناسه‌ی UUID
   * تصادفی ارزش امنیتی ندارد، ولی پیام درست عیب‌یابی را ممکن می‌کند.
   */
  async assertForm(formId: string, user: JwtUser): Promise<FormEntity> {
    if (!formId) throw new BadRequestException('شناسه‌ی فرم لازم است');
    const form = await this.formRepo.findOne({
      where: { id: formId },
      relations: { workspace: true },
    });
    if (!form) throw new NotFoundException('فرم یافت نشد');

    if (await this.isSuperAdmin(user)) return form;

    if (form.workspace?.organizationId !== user.organizationId) {
      throw new ForbiddenException('به این فرم دسترسی ندارید');
    }

    /*
     * فرمِ بخشی (عملیاتی) فقط برای اعضای همان بخش و مدیرانِ سازمان است.
     * بدون این، کارمندِ خانه‌داری می‌توانست با داشتن شناسه‌ی فرم، گزارش‌های
     * واحد فنی را بخواند — هر دو در یک سازمان‌اند و بررسی سازمانی ردشان نمی‌کند.
     */
    if (form.departmentId && !this.isManager(user)) {
      const ids = await this.memberDepartmentIds(user.sub);
      if (!ids.includes(form.departmentId)) {
        throw new ForbiddenException(
          'این فرم متعلق به بخشی است که عضو آن نیستید',
        );
      }
    }
    return form;
  }

  /**
   * انتشار باید متعلق به فرمی در سازمان کاربر باشد.
   *
   * مسیرهای کمپین، کیوسک و لاگ ارسال فقط شناسه‌ی انتشار را می‌گیرند؛ بدون
   * این بررسی، هر کاربر واردشده می‌توانست به نام سازمان دیگری پیامک بفرستد
   * یا فهرست گیرندگان آن را بخواند.
   */
  async assertPublication(
    publicationId: string,
    user: JwtUser,
  ): Promise<PublicationEntity> {
    const publication = publicationId
      ? await this.publicationRepo.findOne({ where: { id: publicationId } })
      : null;
    if (!publication) throw new NotFoundException('انتشار یافت نشد');
    await this.assertForm(publication.formId, user);
    return publication;
  }

  /** فقط برای مسیرهایی که باید به سوپرادمین محدود بمانند. */
  isSuperAdminUser(user: JwtUser): Promise<boolean> {
    return this.isSuperAdmin(user);
  }

  private isSuperAdmin(user: JwtUser) {
    return this.platformSettings.isSuperAdmin(user.sub);
  }
}
