import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'student_guardians' })
export class StudentGuardian {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'char', length: 36 })
  studentId!: string;

  @Column({ name: 'guardian_id', type: 'char', length: 36 })
  guardianId!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  relationship?: string;
}
