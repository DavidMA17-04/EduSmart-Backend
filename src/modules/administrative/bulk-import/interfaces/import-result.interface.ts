import { ImportErrorRecordDto } from '../dto/import-error-record.dto';
import { ImportSuccessRecordDto } from '../dto/import-success-record.dto';
import { ImportSummaryDto } from '../dto/import-summary.dto';

/** Contrato que consume PBI-06. Independiente del origen (Excel u otro). */
export interface ImportResult {
  jobId: string;
  type: string;
  successfulRecords: ImportSuccessRecordDto[];
  errorRecords: ImportErrorRecordDto[];
  summary: ImportSummaryDto;
}
