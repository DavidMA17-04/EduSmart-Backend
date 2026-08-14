import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'communication_reads' })
export class CommunicationRead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'communication_id', type: 'uniqueidentifier' })
  communicationId!: string;

  @Column({ name: 'user_id', type: 'uniqueidentifier' })
  userId!: string;

  @CreateDateColumn({ name: 'read_at' })
  readAt!: Date;
}
