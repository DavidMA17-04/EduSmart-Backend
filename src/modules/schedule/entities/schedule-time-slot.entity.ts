import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';
import { ScheduleEntry } from './schedule-entry.entity';

@Entity({ name: 'schedule_time_slots' })
export class ScheduleTimeSlot {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_schedule_time_slots' })
  id!: number;

  @Column({ name: 'lesson_number', type: 'int', nullable: true })
  lessonNumber!: number | null;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  /** Stored as TIME; exposed as HH:mm:ss string */
  @Column({ name: 'start_time', type: 'time' })
  startTime!: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime!: string;

  @Column({ name: 'display_order', type: 'int' })
  displayOrder!: number;

  @Column({
    name: 'slot_type',
    type: 'enum',
    enum: ScheduleSlotType,
  })
  slotType!: ScheduleSlotType;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => ScheduleEntry, (entry) => entry.timeSlot)
  entries?: ScheduleEntry[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
