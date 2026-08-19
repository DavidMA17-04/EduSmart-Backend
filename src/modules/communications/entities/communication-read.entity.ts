import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'communication_reads' })
export class CommunicationRead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'communication_id', type: 'char', length: 36 })
  communicationId!: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @CreateDateColumn({ name: 'read_at' })
  readAt!: Date;
}
