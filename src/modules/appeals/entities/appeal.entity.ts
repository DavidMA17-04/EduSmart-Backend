import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'appeals' })
export class Appeal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'uniqueidentifier' })
  studentId!: string;

  @Column({ type: 'nvarchar', length: 200 })
  subject!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'nvarchar', length: 30, default: 'SUBMITTED' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
