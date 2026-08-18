import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'attendance' })
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'char', length: 36 })
  studentId!: string;

  @Column({ name: 'section_id', type: 'char', length: 36, nullable: true })
  sectionId?: string;

  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
