import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormEntity } from '../database/entities/form.entity';
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
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  /** فضای کاری باید متعلق به سازمان کاربر باشد. */
  async assertWorkspace(workspaceId: string, user: JwtUser): Promise<void> {
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
    const form = await this.formRepo.findOne({
      where: { id: formId },
      relations: { workspace: true },
    });
    if (!form) throw new NotFoundException('فرم یافت نشد');

    if (await this.isSuperAdmin(user)) return form;

    if (form.workspace?.organizationId !== user.organizationId) {
      throw new ForbiddenException('به این فرم دسترسی ندارید');
    }
    return form;
  }

  private isSuperAdmin(user: JwtUser) {
    return this.platformSettings.isSuperAdmin(user.sub);
  }
}
