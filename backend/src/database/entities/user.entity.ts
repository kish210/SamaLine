import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrganizationUserEntity } from './organization-user.entity';
import { TIMESTAMP_COLUMN } from '../column-types';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  fullName: string;

  @Column({ type: 'varchar', unique: true, length: 120 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  /**
   * سوپرادمین سکو (گرداننده‌ی سامانه)، نه ادمین سازمان.
   *
   * این نقش فرامستاجری است و فقط تنظیمات سراسری سکو را کنترل می‌کند؛
   * عمدا در جدول کاربران است نه organization_users، چون به هیچ سازمانی
   * تعلق ندارد.
   */
  @Column({ type: 'boolean', default: false })
  isSuperAdmin: boolean;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;

  @OneToMany(() => OrganizationUserEntity, (member) => member.user)
  organizations: OrganizationUserEntity[];
}
