import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicPeriodsModule } from '../academic-periods/academic-periods.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { RolesModule } from '../roles/roles.module';
import { SpecialtiesModule } from '../specialties/specialties.module';
import { TeachingAssignment } from '../teaching-assignments/entities/teaching-assignment.entity';
import { AuditLog } from './entities/audit-log.entity';
import { User } from './entities/user.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { UsersService } from './services/users.service';
import { UsersBootstrapService } from './services/users-bootstrap.service';
import { Utf8RepairService } from '../../../database/services/utf8-repair.service';
import { AuditLogService } from './services/audit-log.service';
import { UsersRepository } from './repositories/users.repository';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { UsersController } from './controllers/users.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRoleEntity, AuditLog, TeachingAssignment]),
    RolesModule,
    PermissionsModule,
    AcademicPeriodsModule,
    SpecialtiesModule,
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UsersBootstrapService,
    Utf8RepairService,
    UsersRepository,
    AuditLogService,
    AuditLogRepository,
  ],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
