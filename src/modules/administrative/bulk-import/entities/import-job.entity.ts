import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ImportErrorRecordDto } from '../dto/import-error-record.dto';
import { ImportSuccessRecordDto } from '../dto/import-success-record.dto';
import { ImportSummaryDto } from '../dto/import-summary.dto';

/**
 * Persistencia del resultado de una importación, no del archivo origen.
 * El motor Excel futuro escribirá aquí; PBI-06 solo lee este contrato.
 */
@Entity({ name: 'import_jobs' })
export class ImportJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 80, default: 'users' })
  type!: string;

  @Column({ name: 'successful_records', type: 'json' })
  successfulRecords!: ImportSuccessRecordDto[];

  @Column({ name: 'error_records', type: 'json' })
  errorRecords!: ImportErrorRecordDto[];

  @Column({ type: 'json' })
  summary!: ImportSummaryDto;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
