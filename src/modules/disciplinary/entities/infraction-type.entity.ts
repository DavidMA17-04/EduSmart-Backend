import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InfractionSeverity } from '../constants/infraction-severity.constant';

@Entity({ name: 'disciplinary_infraction_types' })
export class InfractionTypeEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_disciplinary_infraction_types' })
  id!: number;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: InfractionSeverity })
  severity!: InfractionSeverity;

  @Column({ name: 'legal_reference', type: 'varchar', length: 100, nullable: true })
  legalReference!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
