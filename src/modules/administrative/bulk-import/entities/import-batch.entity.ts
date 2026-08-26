import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ImportRecord } from './import-record.entity';

@Entity({ name: 'import_batches' })
export class ImportBatch {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_import_batches' })
  id!: number;

  @Column({ type: 'varchar', length: 80, default: 'users' })
  type!: string;

  @Column({ type: 'json', nullable: true })
  summary?: Record<string, number> | null;

  @OneToMany(() => ImportRecord, (record) => record.batch, { cascade: true })
  records?: ImportRecord[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
