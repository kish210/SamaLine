import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';
import { OrganizationRole } from './organization-user.entity';

@Entity('api_keys')
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  keyPrefix: string;

  @Column({ type: 'varchar', length: 120 })
  keyHash: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * اختیار کلید، با همان نقش‌های سازمانی.
   *
   * کلید مثل یک عضو ماشینی تیم رفتار می‌کند، پس همان بررسی نقشِ مسیرها روی
   * آن هم اعمال می‌شود و لازم نیست سامانه‌ی مجوز دومی نگه داشته شود.
   * پیش‌فرض «بیننده» است: کلیدی که نقشش داده نشود نباید چیزی عوض کند.
   */
  @Column({ type: 'varchar', length: 20, default: OrganizationRole.VIEWER })
  role: OrganizationRole;

  /** آخرین استفاده؛ برای تشخیص کلید فراموش‌شده یا لو رفته. */
  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  lastUsedAt: Date | null;

  /** انقضای اختیاری؛ خالی یعنی بدون انقضا. */
  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  expiresAt: Date | null;

  @Column({ type: JSON_COLUMN, default: {} })
  scopes: Record<string, unknown>;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
