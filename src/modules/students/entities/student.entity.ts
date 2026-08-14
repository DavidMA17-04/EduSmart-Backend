import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'students' })
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'first_name', type: 'nvarchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'nvarchar', length: 100 })
  lastName!: string;

  @Column({ type: 'nvarchar', length: 50, nullable: true })
  document?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
