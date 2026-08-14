import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'absences' })
export class Absence {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uniqueidentifier' })
  studentId!: string;

  @Column({ name: 'absence_date', type: 'date' })
  absenceDate!: string;

  @Column({ type: 'nvarchar', length: 30, default: 'PENDING' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
