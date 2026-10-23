import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { DefenseChannel } from '../constants/disciplinary.enums';

@Entity({ name: 'disciplinary_defenses' })
export class DisciplinaryDefenseEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_disciplinary_defenses' })
  id!: number;

  @Column({ name: 'id_disciplinary_cases', type: 'int' })
  caseId!: number;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'enum', enum: DefenseChannel })
  channel!: DefenseChannel;

  @Column({ name: 'id_users_presented_by', type: 'int' })
  presentedByUserId!: number;

  @Column({ name: 'presented_at', type: 'datetime' })
  presentedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
