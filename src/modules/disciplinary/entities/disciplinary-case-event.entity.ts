import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { EventVisibility } from '../constants/disciplinary.enums';

@Entity({ name: 'disciplinary_case_events' })
export class DisciplinaryCaseEventEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_disciplinary_case_events' })
  id!: number;

  @Column({ name: 'id_disciplinary_cases', type: 'int' })
  caseId!: number;

  @Column({ type: 'varchar', length: 40 })
  type!: string;

  @Column({ name: 'id_users_actor', type: 'int', nullable: true })
  actorUserId!: number | null;

  @Column({ name: 'from_status', type: 'varchar', length: 32, nullable: true })
  fromStatus!: string | null;

  @Column({ name: 'to_status', type: 'varchar', length: 32, nullable: true })
  toStatus!: string | null;

  @Column({ type: 'json', nullable: true })
  payload!: Record<string, unknown> | null;

  @Column({ type: 'enum', enum: EventVisibility, default: EventVisibility.PUBLIC })
  visibility!: EventVisibility;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
