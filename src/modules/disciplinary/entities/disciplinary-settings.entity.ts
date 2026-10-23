import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'disciplinary_settings' })
export class DisciplinarySettingsEntity {
  @PrimaryColumn({ name: 'id_disciplinary_settings', type: 'int' })
  id!: number;

  @Column({ name: 'recidivism_threshold', type: 'int', default: 3 })
  recidivismThreshold!: number;

  @Column({ name: 'conduct_alert_threshold', type: 'int', default: 80 })
  conductAlertThreshold!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
