import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubjectStatus } from '../../../../common/enums/subject-status.enum';

@Entity({ name: 'subjects' })
export class SubjectEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_subjects' })
  id!: number;

  @Column({ type: 'varchar', length: 150, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 30, nullable: true, unique: true })
  code?: string | null;

  @Column({
    type: 'enum',
    enum: SubjectStatus,
    default: SubjectStatus.ACTIVE,
  })
  status!: SubjectStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
