import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../../integrations/mail/mail.module';
import { RolesModule } from '../roles/roles.module';
import { User } from '../users/entities/user.entity';
import { UserRoleEntity } from '../users/entities/user-role.entity';
import { UsersModule } from '../users/users.module';
import { BulkImportController } from './controllers/bulk-import.controller';
import { ImportBatch } from './entities/import-batch.entity';
import { ImportRecord } from './entities/import-record.entity';
import { ImportBatchesRepository } from './repositories/import-batches.repository';
import { BulkImportService } from './services/bulk-import.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRoleEntity, ImportBatch, ImportRecord]),
    UsersModule,
    RolesModule,
    MailModule,
  ],
  controllers: [BulkImportController],
  providers: [BulkImportService, ImportBatchesRepository],
  exports: [BulkImportService],
})
export class BulkImportModule {}
