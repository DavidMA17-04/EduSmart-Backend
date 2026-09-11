import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AcademicOfferingKind } from '../../../../common/enums/academic-offering-kind.enum';
import { AcademicPeriod } from '../../academic-periods/entities/academic-period.entity';
import { GroupEntity } from '../../sections/entities/group.entity';
import { SpecialtyEntity } from '../../specialties/entities/specialty.entity';
import { SubjectEntity } from '../../subjects/entities/subject.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Teaching assignment: teacher + group + optional academic offering.
 * Guide-only rows keep offering_kind / FKs NULL.
 *
 * Uniqueness (MySQL): VIRTUAL `assignment_fingerprint` + UNIQUE
 * (IFNULL coalescing) — see migration 008. Service also pre-checks duplicates.
 */
@Entity({ name: 'teaching_assignments' })
export class TeachingAssignment {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_teaching_assignments' })
  id!: number;

  @Column({ name: 'id_users', type: 'int' })
  userId!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_users' })
  user!: User;

  @Column({ name: 'id_groups', type: 'int' })
  groupId!: number;

  @ManyToOne(() => GroupEntity, (group) => group.teachingAssignments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_groups' })
  group!: GroupEntity;

  @Column({ name: 'id_academic_periods', type: 'int', nullable: true })
  academicPeriodId?: number | null;

  @ManyToOne(() => AcademicPeriod, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_academic_periods' })
  academicPeriod?: AcademicPeriod | null;

  @Column({ name: 'is_guide_teacher', type: 'boolean', default: false })
  isGuideTeacher!: boolean;

  @Column({
    name: 'offering_kind',
    type: 'enum',
    enum: AcademicOfferingKind,
    nullable: true,
  })
  offeringKind?: AcademicOfferingKind | null;

  @Column({ name: 'id_subjects', type: 'int', nullable: true })
  subjectId?: number | null;

  @ManyToOne(() => SubjectEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_subjects' })
  subject?: SubjectEntity | null;

  @Column({ name: 'id_specialties', type: 'int', nullable: true })
  specialtyId?: number | null;

  @ManyToOne(() => SpecialtyEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_specialties' })
  specialty?: SpecialtyEntity | null;

  /** DB-generated; do not write from app */
  @Column({
    name: 'assignment_fingerprint',
    type: 'varchar',
    length: 80,
    insert: false,
    update: false,
    select: true,
  })
  assignmentFingerprint?: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
