import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AttendanceSessionStatus } from '../../../common/enums/attendance-session-status.enum';
import { TeachingAssignment } from '../../administrative/teaching-assignments/entities/teaching-assignment.entity';
import { User } from '../../administrative/users/entities/user.entity';
import { ScheduleEntry } from '../../schedule/entities/schedule-entry.entity';
import { Attendance } from './attendance.entity';

@Entity({ name: 'attendance_sessions' })
export class AttendanceSession {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_attendance_sessions' })
  id!: number;

  @Column({ name: 'id_teaching_assignments', type: 'int' })
  teachingAssignmentId!: number;

  @ManyToOne(() => TeachingAssignment, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_teaching_assignments' })
  teachingAssignment!: TeachingAssignment;

  /**
   * Anchor ScheduleEntry of a programmed CLASS occurrence run.
   * NULL for manual wizard sessions.
   */
  @Column({ name: 'id_schedule_entries', type: 'int', nullable: true })
  scheduleEntryId!: number | null;

  @ManyToOne(() => ScheduleEntry, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_schedule_entries' })
  scheduleEntry?: ScheduleEntry | null;

  @Column({ name: 'session_date', type: 'date' })
  sessionDate!: string;

  @Column({ name: 'started_at', type: 'datetime' })
  startedAt!: Date;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt?: Date | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AttendanceSessionStatus,
    default: AttendanceSessionStatus.OPEN,
  })
  status!: AttendanceSessionStatus;

  @Column({ name: 'id_users_created_by', type: 'int' })
  createdByUserId!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_users_created_by' })
  createdBy!: User;

  @OneToMany(() => Attendance, (row) => row.session)
  records?: Attendance[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
