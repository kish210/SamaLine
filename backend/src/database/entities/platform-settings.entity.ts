import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { TIMESTAMP_COLUMN } from '../column-types';

/**
 * شناسه‌ی تنها ردیف این جدول.
 *
 * تنظیمات سکو سراسری است و به سازمان تعلق ندارد؛ کلید ثابت باعث می‌شود
 * حتی با درخواست‌های هم‌زمان هم بیش از یک ردیف ساخته نشود.
 */
export const PLATFORM_SETTINGS_ID = 'singleton';

/**
 * تنظیمات سراسری سکو — فقط سوپرادمین می‌تواند تغییرشان دهد.
 *
 * برخلاف تنظیمات فرم که مال صاحب فرم است، این‌ها متعلق به گرداننده‌ی
 * سامانه‌اند و روی همه‌ی فرم‌های همه‌ی سازمان‌ها اثر می‌گذارند.
 */
@Entity('platform_settings')
export class PlatformSettingsEntity {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  /** نمایش نوار پایین ثابت روی فرم‌های عمومی. */
  @Column({ type: 'boolean', default: true })
  footerEnabled: boolean;

  /** متن نوار؛ خالی یعنی متن پیش‌فرض. */
  @Column({ type: 'varchar', length: 200, default: '' })
  footerText: string;

  /** نشانی مقصد نوار؛ خالی یعنی نوار لینک نمی‌شود. */
  @Column({ type: 'varchar', length: 300, default: '' })
  footerUrl: string;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
