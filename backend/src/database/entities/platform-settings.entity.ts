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

  /**
   * آیا ثبت‌نام عمومی باز است؟
   *
   * سوپرادمین می‌تواند روی سامانه‌ی تک‌مستاجری ثبت‌نام را ببندد تا کسی جز
   * حساب‌های موجود نتواند سازمان تازه بسازد. اولین حساب (bootstrap) همیشه
   * اجازه دارد، وگرنه نصب تازه قفل می‌شود.
   */
  @Column({ type: 'boolean', default: true })
  registrationEnabled: boolean;

  /**
   * سرویس‌دهنده‌ی هوش مصنوعی: 'mock' (بدون اینترنت، پاسخ نمونه) یا 'openai'
   * (هر سرویس سازگار با OpenAI، شامل مدل محلی مثل Ollama).
   */
  @Column({ type: 'varchar', length: 20, default: 'mock' })
  aiProvider: string;

  /** نشانی پایه‌ی سرویس سازگار با OpenAI؛ خالی یعنی مقدار پیش‌فرض. */
  @Column({ type: 'varchar', length: 300, default: '' })
  aiBaseUrl: string;

  /** نام مدل، مثلا gpt-4o-mini یا qwen2.5:3b. */
  @Column({ type: 'varchar', length: 120, default: '' })
  aiModel: string;

  /**
   * کلید API سرویس، رمزشده در سطح ستون (enc:v1:…).
   *
   * برای مدل محلی لازم نیست؛ هر مقدار ساختگی (مثلا «ollama») هم کار می‌کند.
   */
  @Column({ type: 'varchar', length: 500, default: '' })
  aiApiKey: string;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
