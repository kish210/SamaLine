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

  @Column('uuid')
  formId: string;

  @Column({
    type: 'enum',
    enum: PublicationType,
    default: PublicationType.LINK,
  })
  type: PublicationType;

  @Column({
    type: 'enum',
    enum: PublicationAuthMode,
    default: PublicationAuthMode.NONE,
  })
  authMode: PublicationAuthMode;

  @Column({ unique: true, length: 80 })
  token: string;

  @Column({ type: 'jsonb', default: [] })
  tags: string[];

  @Column({ length: 240, nullable: true })
  customDomain: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'int', nullable: true })
  quota: number | null;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, unknown>;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => FormEntity, (form) => form.publications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'formId' })
  form: FormEntity;

  @OneToMany(() => ResponseEntity, (response) => response.publication)
  responses: ResponseEntity[];
}
