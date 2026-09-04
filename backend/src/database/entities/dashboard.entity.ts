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
  type: 'stat' | 'bar' | 'nps' | 'text' | 'score';
  title: string;
  /** فرم مرجع داده‌ی ویجت. */
  formId?: string;
  /** برای نمودار سوال. */
  questionId?: string;
  /** برای ویجت آماری: visits | started | completed | completionRate. */
  metric?: string;
  /** برای ویجت شاخص. */
  scoreKey?: string;
  /** متن ثابت. */
  content?: string;
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
