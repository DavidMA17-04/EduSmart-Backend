import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AcademicPeriod } from '../../academic-periods/entities/academic-period.entity';
import { AcademicYearStatus } from '../enums/academic-year-status.enum';

@Entity({ name: 'academic_years' })
export class AcademicYear {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_academic_years' })
  id!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

  @Column({
    type: 'enum',
    enum: AcademicYearStatus,
    default: AcademicYearStatus.PLANNED,
  })
  status!: AcademicYearStatus;

  @OneToMany(() => AcademicPeriod, (period) => period.academicYear)
  courses?: AcademicPeriod[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
