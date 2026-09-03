import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ResponseEntity } from './response.entity';
import { FormEntity } from './form.entity';

export enum PublicationType {
  LINK = 'link',
}

@Entity('publications')
export class PublicationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  formId: string;

  @Column({ type: 'enum', enum: PublicationType, default: PublicationType.LINK })
  type: PublicationType;

  @Column({ unique: true, length: 80 })
  token: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => FormEntity, (form) => form.publications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'formId' })
  form: FormEntity;

  @OneToMany(() => ResponseEntity, (response) => response.publication)
  responses: ResponseEntity[];
}
