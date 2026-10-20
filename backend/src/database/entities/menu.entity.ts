import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/** یک قلم از فهرست قیمت. */
export interface MenuItem {
  id: string;
  name: string;
  description: string;
  /**
   * قیمت به‌صورت متن، نه عدد.
   *
   * عمدا متن است: «۱۲۰,۰۰۰ تومان»، «از ۸۵ هزار»، «رایگان» و قیمت دو اندازه‌ی
   * یک نوشیدنی، هیچ‌کدام در یک عدد نمی‌گنجند و واحد پول هم باید دست خود
   * صاحب کسب‌وکار بماند.
   */
  price: string;
}

/** یک بخش از منو، مثل «نوشیدنی گرم» یا «صبحانه». */
export interface MenuSection {
  id: string;
  title: string;
  items: MenuItem[];
}

/**
 * منوی QR: یک صفحه‌ی عمومی که با اسکن QR روی میز باز می‌شود.
 *
 * دو شکل محتوا دارد و هر دو با هم هم ممکن است:
 * - عکس: تصویر منوی چاپی، برای وقتی طراحی آماده است و فقط باید دیده شود.
 * - فهرست دستی: بخش‌ها و اقلام با قیمت، که جستجو و به‌روزرسانی‌اش آسان است
 *   و روی موبایل بهتر خوانده می‌شود.
 *
 * نشانی عمومی با «نشانک» است نه شناسه، چون روی QR چاپ می‌شود و باید هم کوتاه
 * بماند و هم با عوض شدن رکورد نشکند.
 */
@Entity('menus')
export class MenuEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  workspaceId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  /** نشانی لوگو بالای صفحه. */
  @Column({ type: 'varchar', length: 500, default: '' })
  logoUrl: string;

  /** عکس‌های منو، به ترتیب نمایش. */
  @Column({ type: JSON_COLUMN, default: '[]' })
  images: string[];

  /** فهرست قیمت دستی. */
  @Column({ type: JSON_COLUMN, default: '[]' })
  sections: MenuSection[];

  /** خاموش‌کردن موقت بدون حذف؛ QRهای چاپ‌شده نباید بی‌معنی شوند. */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
