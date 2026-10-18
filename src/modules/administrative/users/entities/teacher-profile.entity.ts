import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from '../../departments/entities/department.entity';
import { User } from './user.entity';

@Entity({ name: 'teacher_profiles' })
export class TeacherProfile {
  @PrimaryColumn({ type: 'int', name: 'id_users' })
  userId!: number;

  @OneToOne(() => User, (user) => user.teacherProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_users' })
  user!: User;

  @Column({ name: 'id_departments', type: 'int' })
  departmentId!: number;

  @ManyToOne(() => Department, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_departments' })
  department!: Department;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
