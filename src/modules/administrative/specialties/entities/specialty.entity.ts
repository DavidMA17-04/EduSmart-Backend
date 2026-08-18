import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SpecialtyStatus } from '../../../../common/enums/specialty-status.enum';

@Entity({ name: 'specialties' })
export class SpecialtyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  code!: string;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 100 })
  area!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'int' })
  duration!: number;

  @Column({
    type: 'enum',
    enum: SpecialtyStatus,
    default: SpecialtyStatus.ACTIVE,
  })
  status!: SpecialtyStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
