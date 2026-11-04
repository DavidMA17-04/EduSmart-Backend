import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AbsenteeismNotificationChannel } from '../../../common/enums/absenteeism-notification-channel.enum';
import { User } from '../../administrative/users/entities/user.entity';
import { AbsenteeismAlert } from './absenteeism-alert.entity';

@Entity({ name: 'absenteeism_alert_notifications' })
export class AbsenteeismAlertNotification {
  @PrimaryGeneratedColumn({
    type: 'int',
    name: 'id_absenteeism_alert_notifications',
  })
  id!: number;

  @Column({ name: 'id_absenteeism_alerts', type: 'int' })
  alertId!: number;

  @ManyToOne(() => AbsenteeismAlert, (alert) => alert.notifications, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_absenteeism_alerts' })
  alert!: AbsenteeismAlert;

  @Column({
    name: 'channel',
    type: 'enum',
    enum: AbsenteeismNotificationChannel,
    default: AbsenteeismNotificationChannel.IN_APP,
  })
  channel!: AbsenteeismNotificationChannel;

  @Column({ name: 'title', type: 'varchar', length: 200 })
  title!: string;

  @Column({ name: 'body', type: 'text' })
  body!: string;

  @Column({ name: 'payload', type: 'json', nullable: true })
  payload!: Record<string, unknown> | null;

  @Column({ name: 'sent_at', type: 'datetime' })
  sentAt!: Date;

  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt!: Date | null;

  @Column({ name: 'id_users_recipient', type: 'int', nullable: true })
  recipientUserId!: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_users_recipient' })
  recipient?: User | null;
}
