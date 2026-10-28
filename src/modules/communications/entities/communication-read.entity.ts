import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../administrative/users/entities/user.entity';
import { Communication } from './communication.entity';

@Entity({ name: 'communication_reads' })
export class CommunicationRead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'communication_id', type: 'char', length: 36 })
  communicationId!: string;

  @ManyToOne(() => Communication, (comm) => comm.reads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'communication_id' })
  communication?: Communication;

  @Column({ name: 'user_id', type: 'int' })
  userId!: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user?: User;

  @CreateDateColumn({ name: 'read_at' })
  readAt!: Date;

  @Column({ name: 'acknowledged_at', type: 'datetime', nullable: true })
  acknowledgedAt!: Date | null;
}
