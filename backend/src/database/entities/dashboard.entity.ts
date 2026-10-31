import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/** یک ویجت روی داشبورد. */
export interface DashboardWidget {
  id: string;
  /**
   * نوعِ ویجت.
   *
   * سه نوعِ تازه، شکافی را پر می‌کنند که داشبورد را بی‌استفاده کرده بود:
   * `trend` جهتِ حرکت را نشان می‌دهد (بالا می‌رویم یا پایین؟)، `table`
   * پاسخ‌های اخیر را با امکانِ رفتن به خودِ پاسخ می‌آورد، و `verbatim`
   * نظرهای متنی را — ارزشمندترین محتوای نظرسنجی که تا الان اصلاً دیده
   * نمی‌شد.
   */
  type: 'stat' | 'bar' | 'nps' | 'text' | 'score' | 'trend' | 'table' | 'verbatim';
  title: string;
  /** فرم مرجع داده‌ی ویجت. */
  formId?: string;
  /** برای نمودار سوال و نظرهای متنی. */
  questionId?: string;
  /** برای ویجت آماری: visits | started | completed | completionRate. */
  metric?: string;
  /** برای ویجت شاخص. */
  scoreKey?: string;
  /** متن ثابت. */
  content?: string;
  /** گامِ زمانیِ ویجتِ روند. */
  interval?: 'day' | 'week' | 'month';
  /** چند ردیف در جدول/نظرها (پیش‌فرض ۱۰، سقف ۵۰). */
  limit?: number;
  /** جای ویجت در شبکه؛ عرض بر حسب ستون از ۱۲. */
  layout: { x: number; y: number; w: number; h: number };
}

/**
 * داشبورد سفارشی سازمان (بند ۸ سند).
 *
 * چیدمان در JSON نگه داشته می‌شود چون ساختار ویجت‌ها سریع تغییر می‌کند
 * و جدول‌بندی آن ارزش هزینه‌ی مهاجرت را ندارد.
 */
@Entity('dashboards')
@Index(['organizationId'])
export class DashboardEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: JSON_COLUMN, default: [] })
  widgets: DashboardWidget[];

  /** بخشِ مالکِ داشبورد؛ null یعنی داشبوردِ عمومیِ سازمان. */
  @Column({ type: UUID_COLUMN, nullable: true })
  departmentId: string | null;

  /** اشتراک‌گذاری عمومی با لینک، بدون نیاز به ورود. */
  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ type: 'varchar', length: 80, unique: true, nullable: true })
  publicToken: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
