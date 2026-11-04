import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportJob } from '../entities/import-job.entity';

@Injectable()
export class ImportJobsRepository {
  constructor(
    @InjectRepository(ImportJob)
    private readonly repository: Repository<ImportJob>,
  ) {}

  create(data: Partial<ImportJob>): ImportJob {
    return this.repository.create(data);
  }

  async save(entity: ImportJob): Promise<ImportJob> {
    return this.repository.save(entity);
  }

  async findById(id: string): Promise<ImportJob | null> {
    return this.repository.findOne({ where: { id } });
  }
}
