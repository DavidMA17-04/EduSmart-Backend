import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GroupEnrollmentStatus } from '../../../../common/enums/group-enrollment-status.enum';
import { AcademicPeriod } from '../../academic-periods/entities/academic-period.entity';
import { GroupEntity } from '../../sections/entities/group.entity';
import { User } from '../../users/entities/user.entity';

@Entity({ name: 'group_enrollments' })
export class GroupEnrollment {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_group_enrollments' })
  id!: number;

  @Column({ name: 'id_users', type: 'int' })
  userId!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_users' })
  user!: User;

  @Column({ name: 'id_groups', type: 'int' })
  groupId!: number;

  @ManyToOne(() => GroupEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_groups' })
  group!: GroupEntity;

  @Column({ name: 'id_academic_periods', type: 'int' })
  academicPeriodId!: number;

  @ManyToOne(() => AcademicPeriod, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_academic_periods' })
  academicPeriod!: AcademicPeriod;

  @Column({ name: 'starts_on', type: 'date' })
  startsOn!: string;

  @Column({ name: 'ends_on', type: 'date', nullable: true })
  endsOn?: string | null;

  @Column({
    type: 'enum',
    enum: GroupEnrollmentStatus,
    default: GroupEnrollmentStatus.ACTIVE,
  })
  status!: GroupEnrollmentStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
