import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { BulkImportDto } from '../dto/bulk-import.dto';
import { ImportSummaryDto } from '../dto/import-summary.dto';
import { RegisterImportResultDto } from '../dto/register-import-result.dto';
import { ImportJob } from '../entities/import-job.entity';
import { ImportResult } from '../interfaces/import-result.interface';
import { ImportJobsRepository } from '../repositories/import-jobs.repository';

@Injectable()
export class BulkImportService {
  constructor(private readonly importJobsRepository: ImportJobsRepository) {}

  /**
   * Motor de carga (Excel/CSV) — pertenece a otro PBI. Se deja explícitamente pendiente.
   */
  importData(_dto: BulkImportDto) {
    throw new NotImplementedException('Carga masiva pendiente de implementar');
  }

  async registerResult(dto: RegisterImportResultDto): Promise<ImportResult> {
    const summary = this.resolveSummary(dto);
    const job = this.importJobsRepository.create({
      type: dto.type?.trim() || 'users',
      successfulRecords: dto.successfulRecords,
      errorRecords: dto.errorRecords,
      summary,
    });
    const saved = await this.importJobsRepository.save(job);
    return this.toResult(saved);
  }

  async findResult(jobId: string): Promise<ImportResult> {
    const job = await this.importJobsRepository.findById(jobId);
    if (!job) {
      throw new NotFoundException(`Import job ${jobId} not found`);
    }
    return this.toResult(job);
  }

  private resolveSummary(dto: RegisterImportResultDto): ImportSummaryDto {
    const successfulRecords = dto.successfulRecords.length;
    const errorRecords = dto.errorRecords.length;
    return {
      totalRecords: dto.summary?.totalRecords ?? successfulRecords + errorRecords,
      successfulRecords: dto.summary?.successfulRecords ?? successfulRecords,
      errorRecords: dto.summary?.errorRecords ?? errorRecords,
    };
  }

  private toResult(job: ImportJob): ImportResult {
    return {
      jobId: job.id,
      type: job.type,
      successfulRecords: job.successfulRecords ?? [],
      errorRecords: job.errorRecords ?? [],
      summary: job.summary,
    };
  }
}
