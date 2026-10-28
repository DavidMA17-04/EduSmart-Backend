import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Communication } from './communication.entity';

export enum RecipientType {
  ALL = 'ALL',
  ROLE = 'ROLE',
  GROUP = 'GROUP',
  USER = 'USER',
}

@Entity({ name: 'communication_recipients' })
export class CommunicationRecipient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'communication_id', type: 'char', length: 36 })
  communicationId!: string;

  @ManyToOne(() => Communication, (comm) => comm.recipients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'communication_id' })
  communication?: Communication;

  @Column({
    name: 'recipient_type',
    type: 'enum',
    enum: RecipientType,
  })
  recipientType!: RecipientType;

  @Column({ name: 'target_id', type: 'varchar', length: 100, nullable: true })
  targetId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
