import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AcademicPeriod } from '../../academic-periods/entities/academic-period.entity';
import { GroupEntity } from '../../sections/entities/group.entity';
import { User } from '../../users/entities/user.entity';

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

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
