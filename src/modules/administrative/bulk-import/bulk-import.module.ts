import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { BulkImportController } from './controllers/bulk-import.controller';
import { ImportBatch } from './entities/import-batch.entity';
import { ImportRecord } from './entities/import-record.entity';
import { ImportBatchesRepository } from './repositories/import-batches.repository';
import { BulkImportService } from './services/bulk-import.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ImportBatch, ImportRecord]),
    UsersModule,
  ],
  controllers: [BulkImportController],
  providers: [BulkImportService, ImportBatchesRepository],
  exports: [BulkImportService],
})
export class BulkImportModule {}
