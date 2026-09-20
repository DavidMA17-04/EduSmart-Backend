import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AttendanceCalendarExceptionType } from '../../../common/enums/attendance-calendar-exception-type.enum';
import { AcademicPeriod } from '../../administrative/academic-periods/entities/academic-period.entity';
import { SectionEntity } from '../../administrative/sections/entities/section.entity';
import { User } from '../../administrative/users/entities/user.entity';

@Entity({ name: 'attendance_calendar_exceptions' })
export class AttendanceCalendarException {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_attendance_calendar_exceptions' })
  id!: number;

  @Column({ name: 'id_academic_periods', type: 'int' })
  academicPeriodId!: number;

  @ManyToOne(() => AcademicPeriod, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_academic_periods' })
  academicPeriod!: AcademicPeriod;

  /** Optional scope: null = entire school / all sections in the period. */
  @Column({ name: 'id_sections', type: 'int', nullable: true })
  sectionId?: number | null;

  @ManyToOne(() => SectionEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_sections' })
  section?: SectionEntity | null;

  @Column({ name: 'title', type: 'varchar', length: 200 })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

  @Column({
    name: 'exception_type',
    type: 'enum',
    enum: AttendanceCalendarExceptionType,
  })
  exceptionType!: AttendanceCalendarExceptionType;

  @Column({ name: 'id_users_created_by', type: 'int' })
  createdByUserId!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_users_created_by' })
  createdBy!: User;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
