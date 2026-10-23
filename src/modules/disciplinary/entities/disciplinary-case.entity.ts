import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import {
  DisciplinaryCaseStatus,
  DisciplinaryTrack,
  ResolutionOutcome,
} from '../constants/disciplinary.enums';

@Entity({ name: 'disciplinary_cases' })
export class DisciplinaryCaseEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_disciplinary_cases' })
  id!: number;

  @Column({ name: 'case_number', type: 'varchar', length: 16 })
  caseNumber!: string;

  @Column({ name: 'id_users_student', type: 'int' })
  studentUserId!: number;

  @Column({ name: 'id_groups', type: 'int' })
  groupId!: number;

  @Column({ name: 'id_academic_periods', type: 'int' })
  academicPeriodId!: number;

  @Column({ name: 'id_disciplinary_infraction_types', type: 'int' })
  infractionTypeId!: number;

  @Column({ name: 'id_subjects', type: 'int', nullable: true })
  subjectId!: number | null;

  @Column({ name: 'original_severity', type: 'enum', enum: InfractionSeverity })
  originalSeverity!: InfractionSeverity;

  @Column({ type: 'enum', enum: InfractionSeverity })
  severity!: InfractionSeverity;

  @Column({ type: 'enum', enum: DisciplinaryTrack })
  track!: DisciplinaryTrack;

  @Column({ type: 'enum', enum: DisciplinaryCaseStatus })
  status!: DisciplinaryCaseStatus;

  @Column({ name: 'occurred_at', type: 'datetime' })
  occurredAt!: Date;

  @Column({ type: 'varchar', length: 150 })
  place!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'text', nullable: true })
  witnesses!: string | null;

  @Column({ name: 'is_late_report', type: 'boolean', default: false })
  isLateReport!: boolean;

  @Column({ name: 'late_report_reason', type: 'varchar', length: 500, nullable: true })
  lateReportReason!: string | null;

  @Column({ name: 'missing_guide_teacher', type: 'boolean', default: false })
  missingGuideTeacher!: boolean;

  @Column({ name: 'id_users_reporter', type: 'int' })
  reporterUserId!: number;

  @Column({ name: 'id_users_responsible', type: 'int', nullable: true })
  responsibleUserId!: number | null;

  @Column({ name: 'step_started_on', type: 'date' })
  stepStartedOn!: string;

  @Column({ name: 'step_business_days', type: 'int', default: 0 })
  stepBusinessDays!: number;

  @Column({ name: 'resolution_outcome', type: 'enum', enum: ResolutionOutcome, nullable: true })
  resolutionOutcome!: ResolutionOutcome | null;

  @Column({ name: 'resolution_reasoning', type: 'text', nullable: true })
  resolutionReasoning!: string | null;

  @Column({ name: 'notified_at', type: 'datetime', nullable: true })
  notifiedAt!: Date | null;

  @Column({ name: 'firm_at', type: 'datetime', nullable: true })
  firmAt!: Date | null;

  @Column({ name: 'annulled_at', type: 'datetime', nullable: true })
  annulledAt!: Date | null;

  @Column({ name: 'annul_reason', type: 'text', nullable: true })
  annulReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}

@Entity({ name: 'disciplinary_case_sequences' })
export class DisciplinaryCaseSequenceEntity {
  @PrimaryColumn({ type: 'smallint' })
  year!: number;

  @Column({ name: 'last_value', type: 'int', default: 0 })
  lastValue!: number;
}
