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
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_specialties' })
  id!: number;

  @Column({ type: 'varchar', length: 150, unique: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

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
