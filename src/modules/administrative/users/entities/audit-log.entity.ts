import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_audit_logs' })
  id!: number;

  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actorId?: number | null;

  @Column({ type: 'varchar', length: 40 })
  action!: string;

  @Column({ type: 'varchar', length: 80 })
  entity!: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 36 })
  entityId!: string;

  @Column({ type: 'json', nullable: true })
  before?: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  after?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
