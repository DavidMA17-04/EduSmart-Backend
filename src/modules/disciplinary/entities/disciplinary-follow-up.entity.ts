import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'disciplinary_follow_ups' })
export class DisciplinaryFollowUp {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'disciplinary_action_id', type: 'char', length: 36 })
  disciplinaryActionId!: string;

  @Column({ type: 'varchar', length: 500 })
  notes!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
