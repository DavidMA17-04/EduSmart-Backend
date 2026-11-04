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
import { SectionStatus } from '../../../../common/enums/section-status.enum';
import { AcademicPeriod } from '../../academic-periods/entities/academic-period.entity';
import { SpecialtyEntity } from '../../specialties/entities/specialty.entity';
import { GroupEntity } from './group.entity';

@Entity({ name: 'sections' })
export class SectionEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_sections' })
  id!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'grade_level', type: 'int' })
  gradeLevel!: number;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'id_academic_periods', type: 'int' })
  academicPeriodId!: number;

  @ManyToOne(() => AcademicPeriod, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_academic_periods' })
  academicPeriod!: AcademicPeriod;

  @Column({ name: 'id_specialties', type: 'int', nullable: true })
  specialtyId!: number | null;

  @ManyToOne(() => SpecialtyEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_specialties' })
  specialty?: SpecialtyEntity | null;

  @Column({
    type: 'enum',
    enum: SectionStatus,
    default: SectionStatus.ACTIVE,
  })
  status!: SectionStatus;

  @OneToMany(() => GroupEntity, (group) => group.section)
  groups!: GroupEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
