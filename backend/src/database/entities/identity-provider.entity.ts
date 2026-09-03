import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ENUM_COLUMN,
  JSON_COLUMN,
  TIMESTAMP_COLUMN,
  UUID_COLUMN,
} from '../column-types';

export enum IdentityProviderType {
  OAUTH = 'oauth',
  LDAP = 'ldap',
}

@Entity('identity_providers')
export class IdentityProviderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: ENUM_COLUMN, enum: IdentityProviderType })
  type: IdentityProviderType;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: JSON_COLUMN, default: {} })
  config: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
