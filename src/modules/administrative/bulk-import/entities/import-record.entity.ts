import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ImportRecordStatus } from '../enums/import-record-status.enum';
import { ImportBatch } from './import-batch.entity';

@Entity({ name: 'import_records' })
export class ImportRecord {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id_import_records' })
  id!: number;

  @Column({ name: 'id_import_batches', type: 'int' })
  batchId!: number;

  @ManyToOne(() => ImportBatch, (batch) => batch.records, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_import_batches' })
  batch!: ImportBatch;

  @Column({ name: 'row_number', type: 'int' })
  rowNumber!: number;

  @Column({
    type: 'enum',
    enum: ImportRecordStatus,
    default: ImportRecordStatus.SUCCESS,
  })
  status!: ImportRecordStatus;

  @Column({ type: 'json', nullable: true })
  payload?: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;
}
