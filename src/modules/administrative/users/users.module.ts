import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '../roles/roles.module';
import { AuditLog } from './entities/audit-log.entity';
import { User } from './entities/user.entity';
import { UsersService } from './services/users.service';
import { UsersBootstrapService } from './services/users-bootstrap.service';
import { AuditLogService } from './services/audit-log.service';
import { UsersRepository } from './repositories/users.repository';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { UsersController } from './controllers/users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuditLog]), RolesModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersBootstrapService,
    UsersRepository,
    AuditLogService,
    AuditLogRepository,
  ],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
