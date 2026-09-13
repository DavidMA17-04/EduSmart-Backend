import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../administrative/users/entities/user.entity';

/**
 * Puente mínimo Encargado → Estudiante (PBI-27 cierre).
 * Compatible con `users.id_users` (int). No sustituye al futuro
 * diseño real de `student_guardians` (uuid, aún stub).
 */
@Entity({ name: 'guardian_student_links' })
export class GuardianStudentLink {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_guardian_student_links' })
  id!: number;

  @Column({ name: 'id_users_guardian', type: 'int' })
  guardianUserId!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_users_guardian' })
  guardian!: User;

  @Column({ name: 'id_users_student', type: 'int' })
  studentUserId!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_users_student' })
  student!: User;

  @Column({ name: 'relationship', type: 'varchar', length: 50, nullable: true })
  relationship?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
