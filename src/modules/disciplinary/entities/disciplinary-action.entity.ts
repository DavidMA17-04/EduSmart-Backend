import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'disciplinary_actions' })
export class DisciplinaryAction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uniqueidentifier' })
  studentId!: string;

  @Column({ type: 'nvarchar', length: 100 })
  type!: string;

  @Column({ type: 'nvarchar', length: 500 })
  description!: string;

  @Column({ type: 'nvarchar', length: 30, default: 'OPEN' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
