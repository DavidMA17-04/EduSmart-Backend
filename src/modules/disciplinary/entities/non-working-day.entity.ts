import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'non_working_days' })
export class NonWorkingDayEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_non_working_days' })
  id!: number;

  @Column({ type: 'date', unique: true })
  day!: string;

  @Column({ type: 'varchar', length: 200 })
  reason!: string;

  @Column({ name: 'id_users_author', type: 'int' })
  authorUserId!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
