import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AbsenteeismAlertStatus } from '../../../common/enums/absenteeism-alert-status.enum';
import { AbsenteeismRiskLevel } from '../../../common/enums/absenteeism-risk-level.enum';
import { GroupEntity } from '../../administrative/sections/entities/group.entity';
import { User } from '../../administrative/users/entities/user.entity';
import { AbsenteeismAlertNotification } from './absenteeism-alert-notification.entity';

@Entity({ name: 'absenteeism_alerts' })
export class AbsenteeismAlert {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_absenteeism_alerts' })
  id!: number;

  @Column({ name: 'id_users_student', type: 'int' })
  studentUserId!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_users_student' })
  student!: User;

  @Column({ name: 'id_groups', type: 'int', nullable: true })
  groupId!: number | null;

  @ManyToOne(() => GroupEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_groups' })
  group?: GroupEntity | null;

  @Column({
    name: 'risk_level',
    type: 'enum',
    enum: AbsenteeismRiskLevel,
  })
  riskLevel!: AbsenteeismRiskLevel;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AbsenteeismAlertStatus,
    default: AbsenteeismAlertStatus.NEW,
  })
  status!: AbsenteeismAlertStatus;

  @Column({ name: 'rule_codes', type: 'json' })
  ruleCodes!: string[];

  @Column({ name: 'unjustified_absences_month', type: 'int', default: 0 })
  unjustifiedAbsencesMonth!: number;

  @Column({ name: 'absences_period', type: 'int', default: 0 })
  absencesPeriod!: number;

  @Column({ name: 'consecutive_absences', type: 'int', default: 0 })
  consecutiveAbsences!: number;

  @Column({
    name: 'attendance_percent',
    type: 'decimal',
    precision: 5,
    scale: 1,
    default: 0,
  })
  attendancePercent!: number;

  @Column({ name: 'last_absence_date', type: 'date', nullable: true })
  lastAbsenceDate!: string | null;

  @Column({ name: 'window_start', type: 'date' })
  windowStart!: string;

  @Column({ name: 'window_end', type: 'date' })
  windowEnd!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120, unique: true })
  idempotencyKey!: string;

  @Column({ name: 'triggered_at', type: 'datetime' })
  triggeredAt!: Date;

  @Column({ name: 'acknowledged_at', type: 'datetime', nullable: true })
  acknowledgedAt!: Date | null;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt!: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @OneToMany(() => AbsenteeismAlertNotification, (row) => row.alert)
  notifications?: AbsenteeismAlertNotification[];
}
