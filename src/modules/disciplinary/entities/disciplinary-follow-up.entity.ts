import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'disciplinary_follow_ups' })
export class DisciplinaryFollowUp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'disciplinary_action_id', type: 'uniqueidentifier' })
  disciplinaryActionId!: string;

  @Column({ type: 'nvarchar', length: 500 })
  notes!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
