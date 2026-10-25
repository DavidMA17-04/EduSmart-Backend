import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { AppealKind, AppealOutcome } from '../constants/disciplinary.enums';

@Entity({ name: 'disciplinary_appeals' })
export class DisciplinaryAppealEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_disciplinary_appeals' })
  id!: number;

  @Column({ name: 'id_disciplinary_cases', type: 'int' })
  caseId!: number;

  @Column({ type: 'enum', enum: AppealKind })
  kind!: AppealKind;

  @Column({ name: 'is_subsidiary', type: 'boolean', default: false })
  isSubsidiary!: boolean;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'filed_at', type: 'datetime' })
  filedAt!: Date;

  @Column({ name: 'id_users_filed_by', type: 'int' })
  filedByUserId!: number;

  @Column({ type: 'enum', enum: AppealOutcome, nullable: true })
  outcome!: AppealOutcome | null;

  @Column({ name: 'new_severity', type: 'enum', enum: InfractionSeverity, nullable: true })
  newSeverity!: InfractionSeverity | null;

  @Column({ type: 'text', nullable: true })
  reasoning!: string | null;

  @Column({ name: 'id_users_resolver', type: 'int', nullable: true })
  resolverUserId!: number | null;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
