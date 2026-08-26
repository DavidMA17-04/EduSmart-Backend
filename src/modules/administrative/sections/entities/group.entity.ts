import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { SectionEntity } from './section.entity';

@Entity({ name: 'groups' })
@Index(['sectionId', 'name'], { unique: true })
export class GroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Column({ name: 'student_count', type: 'int', default: 0 })
  studentCount!: number;

  @Column({ name: 'section_id', type: 'char', length: 36 })
  sectionId!: string;

  @ManyToOne(() => SectionEntity, (section) => section.groups, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'section_id' })
  section!: SectionEntity;

  @Column({ name: 'guide_teacher_id', type: 'char', length: 36, nullable: true })
  guideTeacherId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'guide_teacher_id' })
  guideTeacher?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}