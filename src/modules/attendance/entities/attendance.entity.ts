import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AttendanceRegistrationMethod } from '../../../common/enums/attendance-registration-method.enum';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';
import { User } from '../../administrative/users/entities/user.entity';
import { AttendanceSession } from './attendance-session.entity';

/**
 * One attendance mark per student per session.
 * Table `attendance` (MER singular); student = User with Estudiante role.
 */
@Entity({ name: 'attendance' })
export class Attendance {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_attendance' })
  id!: number;

  @Column({ name: 'id_attendance_sessions', type: 'int' })
  attendanceSessionId!: number;

  @ManyToOne(() => AttendanceSession, (session) => session.records, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_attendance_sessions' })
  session!: AttendanceSession;

  @Column({ name: 'id_users_student', type: 'int' })
  studentUserId!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_users_student' })
  student!: User;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AttendanceStatus,
  })
  status!: AttendanceStatus;

  @Column({
    name: 'registration_method',
    type: 'enum',
    enum: AttendanceRegistrationMethod,
    default: AttendanceRegistrationMethod.MANUAL,
  })
  registrationMethod!: AttendanceRegistrationMethod;

  @Column({ name: 'registered_at', type: 'datetime' })
  registeredAt!: Date;

  @Column({ name: 'id_users_registered_by', type: 'int' })
  registeredByUserId!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_users_registered_by' })
  registeredBy!: User;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  @Column({ name: 'id_users_updated_by', type: 'int', nullable: true })
  updatedByUserId?: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_users_updated_by' })
  updatedBy?: User | null;
}
