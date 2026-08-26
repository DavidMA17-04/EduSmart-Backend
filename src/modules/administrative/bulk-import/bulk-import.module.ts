import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { BulkImportController } from './controllers/bulk-import.controller';
import { BulkImportService } from './services/bulk-import.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), UsersModule],
  controllers: [BulkImportController],
  providers: [BulkImportService],
  exports: [BulkImportService],
})
export class BulkImportModule {}
