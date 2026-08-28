import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportBatch } from '../entities/import-batch.entity';

@Injectable()
export class ImportBatchesRepository {
  constructor(
    @InjectRepository(ImportBatch)
    private readonly repository: Repository<ImportBatch>,
  ) {}

  create(data: Partial<ImportBatch>): ImportBatch {
    return this.repository.create(data);
  }

  async save(entity: ImportBatch): Promise<ImportBatch> {
    return this.repository.save(entity);
  }

  async findById(id: number): Promise<ImportBatch | null> {
    return this.repository.findOne({
      where: { id },
      relations: { records: true },
    });
  }
}
