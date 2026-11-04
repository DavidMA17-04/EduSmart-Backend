import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';
import { AcademicPeriodStatus } from '../enums/academic-period-status.enum';

/** Persistido en `academic_periods`; en UI/MEP se presenta como «curso lectivo». */
@Entity({ name: 'academic_periods' })
export class AcademicPeriod {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_academic_periods' })
  id!: number;

  @Column({ name: 'id_academic_years', type: 'int', nullable: true })
  academicYearId!: number | null;

  @ManyToOne(() => AcademicYear, (year) => year.courses, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_academic_years' })
  academicYear?: AcademicYear | null;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

  @Column({
    type: 'enum',
    enum: AcademicPeriodStatus,
    default: AcademicPeriodStatus.PLANNED,
  })
  status!: AcademicPeriodStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
