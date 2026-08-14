import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'guardians' })
export class Guardian {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'full_name', type: 'nvarchar', length: 150 })
  fullName!: string;

  @Column({ type: 'nvarchar', length: 150, nullable: true })
  email?: string;

  @Column({ type: 'nvarchar', length: 30, nullable: true })
  phone?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
