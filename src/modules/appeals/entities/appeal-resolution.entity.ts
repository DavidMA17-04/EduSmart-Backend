import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'appeal_resolutions' })
export class AppealResolution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'appeal_id', type: 'uniqueidentifier' })
  appealId!: string;

  @Column({ type: 'nvarchar', length: 500 })
  resolution!: string;

  @Column({ type: 'nvarchar', length: 30 })
  outcome!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
