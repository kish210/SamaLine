import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ResponseEntity } from './response.entity';
import { FormEntity } from './form.entity';
import {
  ENUM_COLUMN,
  JSON_COLUMN,
  TIMESTAMP_COLUMN,
  UUID_COLUMN,
} from '../column-types';

export enum PublicationType {
  LINK = 'link',
  QR = 'qr',
  EMBED = 'embed',
  POPUP = 'popup',
  SMS = 'sms',
  EMAIL = 'email',
  KIOSK = 'kiosk',
  APP = 'app',
  PORTAL = 'portal',
  INTERVIEWER = 'interviewer',
  SOCIAL = 'social',
}

export enum PublicationAuthMode {
  NONE = 'none',
  PARAM = 'param',
  LINK = 'link',
  PASSWORD = 'password',
  OTP = 'otp',
  OAUTH = 'oauth',
  LDAP = 'ldap',
}

@Entity('publications')
export class PublicationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  formId: string;

  @Column({
    type: ENUM_COLUMN,
    enum: PublicationType,
    default: PublicationType.LINK,
  })
  type: PublicationType;

  @Column({
    type: ENUM_COLUMN,
    enum: PublicationAuthMode,
    default: PublicationAuthMode.NONE,
  })
  authMode: PublicationAuthMode;

  @Column({ type: 'varchar', unique: true, length: 80 })
  token: string;

  @Column({ type: JSON_COLUMN, default: [] })
  tags: string[];

  @Column({ type: 'varchar', length: 240, nullable: true })
  customDomain: string | null;

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'int', nullable: true })
  quota: number | null;

  @Column({ type: JSON_COLUMN, default: {} })
  config: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @ManyToOne(() => FormEntity, (form) => form.publications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'formId' })
  form: FormEntity;

  @OneToMany(() => ResponseEntity, (response) => response.publication)
  responses: ResponseEntity[];
}
