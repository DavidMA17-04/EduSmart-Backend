import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../administrative/users/entities/user.entity';
import { CommunicationRecipient } from './communication-recipient.entity';
import { CommunicationRead } from './communication-read.entity';

export enum CommunicationPriority {
  URGENT = 'URGENT',
  IMPORTANT = 'IMPORTANT',
  NORMAL = 'NORMAL',
}

export enum CommunicationStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

@Entity({ name: 'communications' })
export class Communication {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'longtext' })
  content!: string;

  @Column({
    type: 'enum',
    enum: CommunicationPriority,
    default: CommunicationPriority.NORMAL,
  })
  priority!: CommunicationPriority;

  @Column({
    type: 'enum',
    enum: CommunicationStatus,
    default: CommunicationStatus.DRAFT,
  })
  status!: CommunicationStatus;

  @Column({ name: 'requires_acknowledgment', type: 'tinyint', default: 0 })
  requiresAcknowledgment!: boolean;

  @Column({ name: 'publish_date', type: 'datetime', nullable: true })
  publishDate!: Date | null;

  @Column({ name: 'expiration_date', type: 'datetime', nullable: true })
  expirationDate!: Date | null;

  @Column({ name: 'author_id', type: 'int' })
  authorId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id', referencedColumnName: 'id' })
  author?: User;

  @OneToMany(() => CommunicationRecipient, (recipient) => recipient.communication, {
    cascade: true,
  })
  recipients?: CommunicationRecipient[];

  @OneToMany(() => CommunicationRead, (read) => read.communication)
  reads?: CommunicationRead[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
