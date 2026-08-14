import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'student_guardians' })
export class StudentGuardian {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uniqueidentifier' })
  studentId!: string;

  @Column({ name: 'guardian_id', type: 'uniqueidentifier' })
  guardianId!: string;

  @Column({ type: 'nvarchar', length: 50, nullable: true })
  relationship?: string;
}
