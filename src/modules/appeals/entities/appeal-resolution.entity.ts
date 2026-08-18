import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'appeal_resolutions' })
export class AppealResolution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'appeal_id', type: 'char', length: 36 })
  appealId!: string;

  @Column({ type: 'varchar', length: 500 })
  resolution!: string;

  @Column({ type: 'varchar', length: 30 })
  outcome!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
