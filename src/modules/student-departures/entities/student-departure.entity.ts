import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum DepartureStatus {
  AUTHORIZED = 'AUTHORIZED',
  REJECTED = 'REJECTED',
}

export enum DepartureType {
  REGULAR = 'REGULAR',
  EARLY = 'EARLY',
  EMERGENCY = 'EMERGENCY',
}

@Entity({ name: 'student_departures' })
export class StudentDeparture {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'student_id', type: 'int' })
  studentId!: number;

  @Column({ name: 'guardian_id', type: 'int', nullable: true })
  guardianId!: number | null;

  @Column({ name: 'guardian_identifier', type: 'varchar', length: 30, nullable: true })
  guardianIdentifier!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  relationship!: string | null;

  @Column({ name: 'security_guard_id', type: 'int' })
  securityGuardId!: number;

  @Column({ name: 'scheduled_permit_id', type: 'char', length: 36, nullable: true })
  scheduledPermitId!: string | null;

  /** Se fija siempre desde la aplicación (UTC) para no depender de la zona del servidor. */
  @Column({ name: 'departure_time', type: 'datetime' })
  departureTime!: Date;

  @Column({ type: 'enum', enum: DepartureStatus })
  status!: DepartureStatus;

  @Column({
    name: 'departure_type',
    type: 'enum',
    enum: DepartureType,
    default: DepartureType.REGULAR,
  })
  departureType!: DepartureType;

  @Column({ name: 'justification_reason', type: 'text', nullable: true })
  justificationReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}
