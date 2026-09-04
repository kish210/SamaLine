import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PLATFORM_SETTINGS_ID,
  PlatformSettingsEntity,
} from '../database/entities/platform-settings.entity';
import { UserEntity } from '../database/entities/user.entity';

/** شکل نوار پایین که به فرم عمومی فرستاده می‌شود. */
export interface PublicFooter {
  enabled: boolean;
  text: string;
  url: string;
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
  ) {}

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
  }): Promise<PlatformSettingsEntity> {
    const current = await this.get();

    if (patch.footerEnabled !== undefined)
      current.footerEnabled = patch.footerEnabled;
    if (patch.footerText !== undefined)
      current.footerText = patch.footerText.trim().slice(0, 200);
    if (patch.footerUrl !== undefined)
      current.footerUrl = safeHttpUrl(patch.footerUrl);

    return this.repo.save(current);
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
