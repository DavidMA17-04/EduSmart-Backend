import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GroupStatus } from '../../../../common/enums/group-status.enum';
import { AcademicPeriod } from '../../academic-periods/entities/academic-period.entity';
import { TeachingAssignment } from '../../teaching-assignments/entities/teaching-assignment.entity';
import { User } from '../../users/entities/user.entity';
import { SectionEntity } from './section.entity';

@Entity({ name: 'groups' })
@Index(['sectionId', 'name'], { unique: true })
export class GroupEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_groups' })
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Column({ name: 'student_count', type: 'int', default: 0 })
  studentCount!: number;

  @Column({ name: 'id_sections', type: 'int' })
  sectionId!: number;

  @ManyToOne(() => SectionEntity, (section) => section.groups, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_sections' })
  section!: SectionEntity;

  @Column({ name: 'id_academic_periods', type: 'int' })
  academicPeriodId!: number;

  @ManyToOne(() => AcademicPeriod, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_academic_periods' })
  academicPeriod!: AcademicPeriod;

  @Column({
    type: 'enum',
    enum: GroupStatus,
    default: GroupStatus.ACTIVE,
  })
  status!: GroupStatus;

  @OneToMany(() => TeachingAssignment, (assignment) => assignment.group)
  teachingAssignments?: TeachingAssignment[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;

  guideTeacherId?: number | null;
  guideTeacher?: User | null;

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      studentCount: this.studentCount,
      sectionId: this.sectionId,
      academicPeriodId: this.academicPeriodId,
      status: this.status,
      guideTeacherId: this.guideTeacherId ?? this.guideTeacher?.id ?? null,
      guideTeacher: this.guideTeacher
        ? {
            id: this.guideTeacher.id,
            name:
              [
                this.guideTeacher.name,
                this.guideTeacher.first_lastname,
                this.guideTeacher.second_lastname,
              ]
                .filter(Boolean)
                .join(' ')
                .trim() || this.guideTeacher.name,
          }
        : null,
      section: this.section
        ? {
            id: this.section.id,
            name: this.section.name,
            gradeLevel: this.section.gradeLevel,
          }
        : undefined,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
