import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/**
 * گفتگوی پیام‌رسانِ یک پرسنل، به‌ازای هر سکو.
 *
 * پیش از این اتصال سه ستونِ تخت روی `personnel` بود، یعنی هر نفر فقط یک
 * پیام‌رسان می‌توانست داشته باشد: کسی که هم بله دارد هم تلگرام باید یکی را
 * فدا می‌کرد، و افزودنِ سکوی تازه مهاجرتِ ساختاری می‌خواست. با جدولِ جدا،
 * سکوی تازه فقط یک مقدارِ تازه در `platform` است.
 *
 * `platform` عمداً enum نیست: افزودنِ پیام‌رسانِ بعدی نباید دو مهاجرت و
 * تغییرِ نوعِ Postgres بخواهد.
 */
@Entity('personnel_bot_links')
// یک گفتگو به دو نفر وصل نمی‌شود؛ وگرنه پیامِ شخصی به نفرِ اشتباه می‌رفت.
@Index('IDX_pbl_platform_chat', ['platform', 'chatId'], { unique: true })
// هر نفر در هر سکو یک گفتگو دارد؛ اتصالِ تازه جایگزینِ قبلی می‌شود.
@Index('IDX_pbl_person_platform', ['personnelId', 'platform'], {
  unique: true,
})
@Index('IDX_pbl_org', ['organizationId'])
export class PersonnelBotLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: UUID_COLUMN })
  personnelId: string;

  /** 'bale'، 'telegram'، یا هر سکوی بعدی. */
  @Column({ type: 'varchar', length: 16 })
  platform: string;

  @Column({ type: 'varchar', length: 64 })
  chatId: string;

  /**
   * فضای کاریِ رباتی که این گفتگو از طریقش وصل شده.
   *
   * یک گفتگو فقط از همان رباتی پیام می‌گیرد که کاربر شروعش کرده، پس برای
   * فرستادنِ اطلاعیه و یادآوری باید دانست کدام توکن به این نفر می‌رسد.
   */
  @Column({ type: UUID_COLUMN, nullable: true })
  workspaceId: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  linkedAt: Date;

  /** آخرین پیامی که از این گفتگو رسید؛ برای تشخیصِ اتصالِ مرده. */
  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  lastSeenAt: Date | null;
}
