import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Bitácora de cambios en entidades administrativas.
 * PBI-08 escribe eventos; la consulta UI (WF-24) es de otro responsable.
 */
@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'actor_id', type: 'varchar', length: 36, nullable: true })
  actorId?: string | null;

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
