import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FollowUpOutcome } from '../constants/disciplinary.enums';

@Entity({ name: 'disciplinary_follow_ups' })
export class DisciplinaryFollowUpEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_disciplinary_follow_ups' })
  id!: number;

  @Column({ name: 'id_disciplinary_cases', type: 'int' })
  caseId!: number;

  @Column({ type: 'varchar', length: 80 })
  kind!: string;

  @Column({ name: 'followed_on', type: 'date' })
  followedOn!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  participants!: string | null;

  @Column({ name: 'review_on', type: 'date', nullable: true })
  reviewOn!: string | null;

  @Column({ type: 'enum', enum: FollowUpOutcome, default: FollowUpOutcome.PENDING })
  outcome!: FollowUpOutcome;

  @Column({ name: 'outcome_note', type: 'text', nullable: true })
  outcomeNote!: string | null;

  @Column({ name: 'id_users_author', type: 'int' })
  authorUserId!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
