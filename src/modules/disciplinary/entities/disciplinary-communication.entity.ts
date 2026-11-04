import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import {
  CommunicationKind,
  DeliveryMedium,
  NotificationEmailStatus,
} from '../constants/disciplinary.enums';

@Entity({ name: 'disciplinary_communications' })
export class DisciplinaryCommunicationEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_disciplinary_communications' })
  id!: number;

  @Column({ name: 'id_disciplinary_cases', type: 'int' })
  caseId!: number;

  @Column({ type: 'enum', enum: CommunicationKind })
  kind!: CommunicationKind;

  @Column({ type: 'mediumtext' })
  body!: string;

  @Column({ name: 'id_users_issuer', type: 'int' })
  issuerUserId!: number;

  @Column({ name: 'issued_at', type: 'datetime' })
  issuedAt!: Date;

  @Column({ name: 'delivery_medium', type: 'enum', enum: DeliveryMedium, nullable: true })
  deliveryMedium!: DeliveryMedium | null;

  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  deliveredAt!: Date | null;

  @Column({ name: 'id_users_delivered_by', type: 'int', nullable: true })
  deliveredByUserId!: number | null;

  @Column({ name: 'received_by_name', type: 'varchar', length: 150, nullable: true })
  receivedByName!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}

@Entity({ name: 'disciplinary_notifications' })
export class DisciplinaryNotificationEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_disciplinary_notifications' })
  id!: number;

  @Column({ name: 'id_disciplinary_communications', type: 'int' })
  communicationId!: number;

  @Column({ name: 'id_users_guardian', type: 'int' })
  guardianUserId!: number;

  @Column({
    name: 'email_status',
    type: 'enum',
    enum: NotificationEmailStatus,
    default: NotificationEmailStatus.SKIPPED,
  })
  emailStatus!: NotificationEmailStatus;

  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt!: Date | null;

  @Column({ name: 'read_ip', type: 'varchar', length: 45, nullable: true })
  readIp!: string | null;

  @Column({ name: 'read_user_agent', type: 'varchar', length: 255, nullable: true })
  readUserAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
