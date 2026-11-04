import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum ScheduledPermitStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
}

@Entity({ name: 'scheduled_departure_permits' })
export class ScheduledDeparturePermit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'int' })
  studentId!: number;

  @Column({ name: 'authorized_by_id', type: 'int' })
  authorizedById!: number;

  /** YYYY-MM-DD (dateStrings: ['DATE'] en la conexión). */
  @Column({ name: 'permit_date', type: 'date' })
  permitDate!: string;

  /** HH:mm:ss */
  @Column({ name: 'departure_time', type: 'time' })
  departureTime!: string;

  @Column({ type: 'varchar', length: 255 })
  reason!: string;

  @Column({ type: 'enum', enum: ScheduledPermitStatus, default: ScheduledPermitStatus.PENDING })
  status!: ScheduledPermitStatus;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
