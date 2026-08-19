import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulkImportController } from './controllers/bulk-import.controller';
import { ImportJob } from './entities/import-job.entity';
import { ImportJobsRepository } from './repositories/import-jobs.repository';
import { BulkImportService } from './services/bulk-import.service';

@Module({
  imports: [TypeOrmModule.forFeature([ImportJob])],
  controllers: [BulkImportController],
  providers: [BulkImportService, ImportJobsRepository],
  exports: [BulkImportService],
})
export class BulkImportModule {}
