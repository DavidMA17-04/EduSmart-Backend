import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'absence_justifications' })
export class AbsenceJustification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'absence_id', type: 'char', length: 36 })
  absenceId!: string;

  @Column({ type: 'varchar', length: 500 })
  reason!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
