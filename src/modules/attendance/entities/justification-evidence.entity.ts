import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../administrative/users/entities/user.entity';
import { AbsenceJustification } from './absence-justification.entity';

@Entity({ name: 'justification_evidences' })
export class JustificationEvidence {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_justification_evidences' })
  id!: number;

  @Column({ name: 'id_absence_justifications', type: 'int' })
  justificationId!: number;

  @ManyToOne(() => AbsenceJustification, (row) => row.evidences, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_absence_justifications' })
  justification!: AbsenceJustification;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'storage_path', type: 'varchar', length: 500 })
  storagePath!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'file_size_bytes', type: 'int' })
  fileSizeBytes!: number;

  @Column({ name: 'id_users_uploaded_by', type: 'int' })
  uploadedByUserId!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_users_uploaded_by' })
  uploadedBy!: User;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
