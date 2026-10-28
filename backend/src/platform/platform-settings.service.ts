import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { decryptSecret, encryptSecret } from '../common/secret-box';
import {
  PLATFORM_SETTINGS_ID,
  PlatformSettingsEntity,
} from '../database/entities/platform-settings.entity';
import { UserEntity } from '../database/entities/user.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import { ResponseEntity, ResponseStatus } from '../database/entities/response.entity';
import { DepartmentEntity } from '../database/entities/department.entity';
import { PersonnelEntity } from '../database/entities/personnel.entity';

/** شکل نوار پایین که به فرم عمومی فرستاده می‌شود. */
export interface PublicFooter {
  enabled: boolean;
  text: string;
  url: string;
}

/** تنظیمات رمزگشایی‌شده‌ی هوش مصنوعی، برای استفاده‌ی داخلی سرویس AI. */
export interface AiConfig {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

/** تنظیمات عمومیِ بی‌خطر که پیش از ورود هم خوانده می‌شوند. */
export interface PublicConfig {
  registrationEnabled: boolean;
}

/** متن پیش‌فرض نوار، وقتی سوپرادمین متنی ننوشته باشد. */
export const DEFAULT_FOOTER_TEXT = 'شرکت سماع رایانه کیش';
export const DEFAULT_FOOTER_URL = 'https://kishwifi.com';

@Injectable()
export class PlatformSettingsService {
  constructor(
    @InjectRepository(PlatformSettingsEntity)
    private readonly repo: Repository<PlatformSettingsEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaces: Repository<WorkspaceEntity>,
    @InjectRepository(OrganizationEntity)
    private readonly organizations: Repository<OrganizationEntity>,
    @InjectRepository(FormEntity)
    private readonly forms: Repository<FormEntity>,
    @InjectRepository(ResponseEntity)
    private readonly responses: Repository<ResponseEntity>,
    @InjectRepository(DepartmentEntity)
    private readonly departments: Repository<DepartmentEntity>,
    @InjectRepository(PersonnelEntity)
    private readonly personnel: Repository<PersonnelEntity>,
  ) {}

  /**
   * نمای فراسازمانیِ سوپرادمین: شمارشِ کلِ سامانه در همه‌ی سازمان‌ها.
   * فقط از مسیرِ محافظت‌شده‌ی SuperAdminGuard صدا زده می‌شود.
   */
  async platformOverview() {
    const [
      organizations,
      users,
      workspaces,
      forms,
      activeForms,
      responses,
      completedResponses,
      departments,
      personnel,
    ] = await Promise.all([
      this.organizations.count(),
      this.users.count(),
      this.workspaces.count(),
      this.forms.count(),
      this.forms.count({ where: { status: FormStatus.ACTIVE } }),
      this.responses.count(),
      this.responses.count({ where: { status: ResponseStatus.COMPLETED } }),
      this.departments.count(),
      this.personnel.count(),
    ]);
    return {
      organizations,
      users,
      workspaces,
      forms,
      activeForms,
      responses,
      completedResponses,
      departments,
      personnel,
    };
  }

  /** فهرست فرامستاجری فضاهای کاری، برای پنل سوپرادمین. */
  async allWorkspaces() {
    const rows = await this.workspaces.find({
      relations: { organization: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      organizationId: workspace.organizationId,
      organizationName: workspace.organization?.name ?? '—',
    }));
  }

  /** آیا این کاربر سوپرادمین سکوست؟ */
  async isSuperAdmin(userId: string): Promise<boolean> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, isSuperAdmin: true },
    });
    return user?.isSuperAdmin === true;
  }

  /**
   * تنظیمات سکو؛ اگر ردیفی نباشد با مقادیر پیش‌فرض ساخته می‌شود.
   *
   * ساخت با `insert ... orIgnore` انجام می‌شود تا دو درخواست هم‌زمان روی
   * نصب تازه، دو ردیف نسازند.
   */
  async get(): Promise<PlatformSettingsEntity> {
    const existing = await this.repo.findOne({
      where: { id: PLATFORM_SETTINGS_ID },
    });
    if (existing) return existing;

    await this.repo
      .createQueryBuilder()
      .insert()
      .values({
        id: PLATFORM_SETTINGS_ID,
        footerEnabled: true,
        footerText: '',
        footerUrl: '',
      })
      .orIgnore()
      .execute();

    return (await this.repo.findOne({
      where: { id: PLATFORM_SETTINGS_ID },
    })) as PlatformSettingsEntity;
  }

  async update(patch: {
    footerEnabled?: boolean;
    footerText?: string;
    footerUrl?: string;
    registrationEnabled?: boolean;
    aiProvider?: string;
    aiBaseUrl?: string;
    aiModel?: string;
    aiApiKey?: string;
  }): Promise<PlatformSettingsEntity> {
    const current = await this.get();

    if (patch.footerEnabled !== undefined)
      current.footerEnabled = patch.footerEnabled;
    if (patch.footerText !== undefined)
      current.footerText = patch.footerText.trim().slice(0, 200);
    if (patch.footerUrl !== undefined)
      current.footerUrl = safeHttpUrl(patch.footerUrl);

    if (patch.registrationEnabled !== undefined)
      current.registrationEnabled = patch.registrationEnabled;

    if (patch.aiProvider !== undefined)
      current.aiProvider = patch.aiProvider === 'openai' ? 'openai' : 'mock';
    if (patch.aiBaseUrl !== undefined)
      current.aiBaseUrl = safeHttpUrl(patch.aiBaseUrl);
    if (patch.aiModel !== undefined)
      current.aiModel = patch.aiModel.trim().slice(0, 120);
    // کلید خالی یعنی «دست نزن»؛ وگرنه کلید موجود با هر ذخیره‌ی فرم پاک می‌شد،
    // چون پنل کلید رمزشده را برنمی‌گرداند. برای پاک‌کردن عمدی، «-» بفرستید.
    if (patch.aiApiKey !== undefined && patch.aiApiKey !== '') {
      current.aiApiKey =
        patch.aiApiKey === '-' ? '' : encryptSecret(patch.aiApiKey.trim());
    }

    return this.repo.save(current);
  }

  /**
   * تنظیمات رمزگشایی‌شده‌ی AI. کلید فقط اینجا باز می‌شود و هرگز از کنترلر
   * بیرون نمی‌رود.
   */
  async getAiConfig(): Promise<AiConfig> {
    const settings = await this.get();
    return {
      provider: settings.aiProvider || 'mock',
      baseUrl: settings.aiBaseUrl || '',
      model: settings.aiModel || '',
      apiKey: settings.aiApiKey ? decryptSecret(settings.aiApiKey) : '',
    };
  }

  /** آیا ثبت‌نام عمومی باز است؟ اولین حساب همیشه مجاز است. */
  async isRegistrationOpen(): Promise<boolean> {
    const settings = await this.get();
    if (settings.registrationEnabled) return true;
    // bootstrap: نصب تازه بدون هیچ کاربری نباید قفل بماند.
    const count = await this.users.count();
    return count === 0;
  }

  /** تنظیمات عمومیِ بی‌خطر برای صفحه‌ی ورود (بدون احراز هویت). */
  async publicConfig(): Promise<PublicConfig> {
    const settings = await this.get();
    return { registrationEnabled: settings.registrationEnabled };
  }

  /**
   * نوار پایین برای فرم عمومی.
   *
   * متن و نشانی خالی به مقدار پیش‌فرض برمی‌گردند تا نصب تازه هم بدون هیچ
   * تنظیمی، برند گرداننده را نشان بدهد.
   */
  async publicFooter(): Promise<PublicFooter> {
    const settings = await this.get();
    return {
      enabled: settings.footerEnabled,
      text: settings.footerText || DEFAULT_FOOTER_TEXT,
      url: settings.footerUrl || DEFAULT_FOOTER_URL,
    };
  }
}

/**
 * فقط نشانی http(s) پذیرفته می‌شود.
 *
 * این مقدار در href صفحه‌ی پاسخ‌دهنده می‌نشیند؛ `javascript:` نباید عبور کند.
 */
function safeHttpUrl(value: string): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? raw.slice(0, 300)
      : '';
  } catch {
    return '';
  }
}
