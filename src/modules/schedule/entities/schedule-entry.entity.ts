import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TeachingAssignment } from '../../administrative/teaching-assignments/entities/teaching-assignment.entity';
import { ScheduleTimeSlot } from './schedule-time-slot.entity';

@Entity({ name: 'schedule_entries' })
export class ScheduleEntry {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_schedule_entries' })
  id!: number;

  @Column({ name: 'id_teaching_assignments', type: 'int' })
  teachingAssignmentId!: number;

  @ManyToOne(() => TeachingAssignment, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_teaching_assignments' })
  teachingAssignment!: TeachingAssignment;

  /** 1=Monday … 5=Friday (MVP) */
  @Column({ name: 'day_of_week', type: 'tinyint' })
  dayOfWeek!: number;

  @Column({ name: 'id_schedule_time_slots', type: 'int' })
  timeSlotId!: number;

  @ManyToOne(() => ScheduleTimeSlot, (slot) => slot.entries, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_schedule_time_slots' })
  timeSlot!: ScheduleTimeSlot;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
