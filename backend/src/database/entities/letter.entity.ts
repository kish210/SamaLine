import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ENUM_COLUMN,
  JSON_COLUMN,
  TIMESTAMP_COLUMN,
  UUID_COLUMN,
} from '../column-types';

/** فوریتِ نامه. */
export enum LetterPriority {
  NORMAL = 'normal',
  URGENT = 'urgent',
}

/** گیرندهٔ اصلی یا رونوشت. */
export enum LetterRecipientKind {
  TO = 'to',
  CC = 'cc',
}

/** پیوستِ نامه؛ از همان سرویسِ آپلودِ موجود می‌آید. */
export interface LetterAttachment {
  name: string;
  url: string;
}

/**
 * نامهٔ داخلیِ سازمان.
 *
 * سندِ ارتباطِ بینِ کارمندهاست، نه پیامِ گپ: شماره‌ی خوانا دارد، حذف
 * نمی‌شود، و پاسخ‌ها رشته می‌سازند. فرستنده **پرسنل** است نه حسابِ پنل،
 * چون نامه بینِ آدم‌های هتل رد و بدل می‌شود و گیرنده هم پرسنل است؛
 * `senderUserId` فقط برای ممیزی نگه داشته می‌شود.
 */
@Entity('letters')
@Index('IDX_letters_org_number', ['organizationId', 'number'], { unique: true })
@Index('IDX_letters_thread', ['threadId', 'createdAt'])
@Index('IDX_letters_sender', ['senderPersonnelId', 'createdAt'])
export class LetterEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  /** شمارهٔ خوانا در هر سازمان، مثلِ `L-00012`. */
  @Column({ type: 'varchar', length: 24 })
  number: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  @Column({ type: 'text', default: '' })
  body: string;

  @Column({ type: UUID_COLUMN })
  senderPersonnelId: string;

  /** حسابِ پنلی که نامه را فرستاد؛ برای ممیزی. */
  @Column({ type: UUID_COLUMN, nullable: true })
  senderUserId: string | null;

  /** بخشِ فرستنده در لحظهٔ ارسال؛ برای گزارشِ بخشی. */
  @Column({ type: UUID_COLUMN, nullable: true })
  departmentId: string | null;

  @Column({
    type: ENUM_COLUMN,
    enum: LetterPriority,
    default: LetterPriority.NORMAL,
  })
  priority: LetterPriority;

  /** نامه‌ای که این پاسخِ آن است؛ null یعنی سرِ رشته. */
  @Column({ type: UUID_COLUMN, nullable: true })
  parentLetterId: string | null;

  /**
   * نامهٔ سرِ رشته (برای نامهٔ اول: خودش).
   *
   * جدا از `parentLetterId` است و عمداً تکرارِ داده را می‌پذیرد: با آن،
   * خواندنِ کلِ یک رشته **یک کوئریِ ایندکس‌خورده** است. بدونِ آن، هر بار
   * باز کردنِ یک مکاتبه یعنی بالا رفتن زنجیره‌ی والدها با چند کوئریِ
   * پشتِ‌سرهم.
   */
  @Column({ type: UUID_COLUMN })
  threadId: string;

  @Column({ type: JSON_COLUMN, default: '[]' })
  attachments: LetterAttachment[];

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}

/**
 * گیرندهٔ یک نامه؛ یک سطر به‌ازای هر نفر.
 *
 * جدولِ جدا و نه آرایهٔ JSON: «نامه‌های نخواندهٔ من» باید با ایندکس و join
 * پرسیده شود، نه با جست‌وجوی متنی داخلِ JSON. وضعیتِ خوانده‌شدن هم
 * به‌ازای هر گیرنده است، پس جایی جز همین سطر ندارد — خواندنِ یک نفر نباید
 * نامه را برای بقیه خوانده‌شده کند.
 */
@Entity('letter_recipients')
@Index('IDX_letter_rcpt_unique', ['letterId', 'personnelId'], { unique: true })
@Index('IDX_letter_rcpt_inbox', ['personnelId', 'readAt'])
export class LetterRecipientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: UUID_COLUMN })
  letterId: string;

  @Column({ type: UUID_COLUMN })
  personnelId: string;

  @Column({
    type: ENUM_COLUMN,
    enum: LetterRecipientKind,
    default: LetterRecipientKind.TO,
  })
  kind: LetterRecipientKind;

  /** null یعنی نخوانده. */
  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  readAt: Date | null;

  /** آخرین باری که همین گیرنده به این نامه پاسخ داد. */
  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  repliedAt: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;
}
