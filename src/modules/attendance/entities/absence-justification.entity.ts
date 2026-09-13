import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JustificationStatus } from '../../../common/enums/justification-status.enum';
import { User } from '../../administrative/users/entities/user.entity';
import { Attendance } from './attendance.entity';
import { JustificationEvidence } from './justification-evidence.entity';

@Entity({ name: 'absence_justifications' })
export class AbsenceJustification {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_absence_justifications' })
  id!: number;

  @Column({ name: 'id_attendance', type: 'int' })
  attendanceId!: number;

  @ManyToOne(() => Attendance, (row) => row.justifications, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'id_attendance' })
  attendance!: Attendance;

  @Column({ name: 'reason', type: 'text' })
  reason!: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: JustificationStatus,
    default: JustificationStatus.PENDING,
  })
  status!: JustificationStatus;

  @Column({ name: 'id_users_reviewed_by', type: 'int', nullable: true })
  reviewedByUserId?: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_users_reviewed_by' })
  reviewedBy?: User | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt?: Date | null;

  @Column({ name: 'decision_notes', type: 'text', nullable: true })
  decisionNotes?: string | null;

  @Column({ name: 'id_users_created_by', type: 'int' })
  createdByUserId!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_users_created_by' })
  createdBy!: User;

  @OneToMany(() => JustificationEvidence, (row) => row.justification)
  evidences?: JustificationEvidence[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
