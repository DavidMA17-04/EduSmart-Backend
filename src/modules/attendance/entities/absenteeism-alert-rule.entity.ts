import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AbsenteeismRiskLevel } from '../../../common/enums/absenteeism-risk-level.enum';

@Entity({ name: 'absenteeism_alert_rules' })
export class AbsenteeismAlertRule {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_absenteeism_alert_rules' })
  id!: number;

  @Column({ name: 'code', type: 'varchar', length: 64, unique: true })
  code!: string;

  @Column({ name: 'label', type: 'varchar', length: 160 })
  label!: string;

  @Column({ name: 'threshold_value', type: 'int' })
  thresholdValue!: number;

  @Column({
    name: 'risk_level',
    type: 'enum',
    enum: AbsenteeismRiskLevel,
    default: AbsenteeismRiskLevel.HIGH,
  })
  riskLevel!: AbsenteeismRiskLevel.HIGH | AbsenteeismRiskLevel.MEDIUM;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
