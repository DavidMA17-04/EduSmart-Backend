import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { EvidenceContext } from '../constants/disciplinary.enums';

@Entity({ name: 'disciplinary_evidences' })
export class DisciplinaryEvidenceEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_disciplinary_evidences' })
  id!: number;

  @Column({ name: 'id_disciplinary_cases', type: 'int' })
  caseId!: number;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes!: number;

  @Column({ name: 'storage_path', type: 'varchar', length: 500 })
  storagePath!: string;

  @Column({ type: 'enum', enum: EvidenceContext })
  context!: EvidenceContext;

  @Column({ name: 'id_users_author', type: 'int' })
  authorUserId!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
