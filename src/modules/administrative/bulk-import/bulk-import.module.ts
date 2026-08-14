import { Module } from '@nestjs/common';
import { BulkImportController } from './controllers/bulk-import.controller';
import { BulkImportService } from './services/bulk-import.service';

@Module({
  controllers: [BulkImportController],
  providers: [BulkImportService],
  exports: [BulkImportService],
})
export class BulkImportModule {}
