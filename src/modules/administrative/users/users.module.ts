import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../../integrations/mail/mail.module';
import { Utf8RepairService } from '../../../database/services/utf8-repair.service';
import { AcademicPeriodsModule } from '../academic-periods/academic-periods.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { RolesModule } from '../roles/roles.module';
import { SpecialtiesModule } from '../specialties/specialties.module';
import { DepartmentsModule } from '../departments/departments.module';
import { GroupEnrollmentsModule } from '../group-enrollments/group-enrollments.module';
import { GroupEnrollment } from '../group-enrollments/entities/group-enrollment.entity';
import { TeachingAssignment } from '../teaching-assignments/entities/teaching-assignment.entity';
import { GuardianStudentLink } from '../../attendance/entities/guardian-student-link.entity';
import { GuardianLinksController } from './controllers/guardian-links.controller';
import { UsersController } from './controllers/users.controller';
import { AccountVerification } from './entities/account-verification.entity';
import { AuditLog } from './entities/audit-log.entity';
import { TeacherProfile } from './entities/teacher-profile.entity';
import { User } from './entities/user.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { AccountVerificationsRepository } from './repositories/account-verifications.repository';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { UsersRepository } from './repositories/users.repository';
import { AccountVerificationService } from './services/account-verification.service';
import { AuditLogService } from './services/audit-log.service';
import { UsersBootstrapService } from './services/users-bootstrap.service';
import { GuardianStudentLinksService } from './services/guardian-student-links.service';
import { UsersService } from './services/users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserRoleEntity,
      AuditLog,
      TeachingAssignment,
      GroupEnrollment,
      AccountVerification,
      TeacherProfile,
      GuardianStudentLink,
    ]),
    MailModule,
    RolesModule,
    PermissionsModule,
    AcademicPeriodsModule,
    SpecialtiesModule,
    DepartmentsModule,
    GroupEnrollmentsModule,
  ],
  controllers: [UsersController, GuardianLinksController],
  providers: [
    UsersService,
    GuardianStudentLinksService,
    UsersBootstrapService,
    Utf8RepairService,
    UsersRepository,
    AuditLogService,
    AuditLogRepository,
    AccountVerificationService,
    AccountVerificationsRepository,
  ],
  exports: [UsersService, UsersRepository, AccountVerificationService, AuditLogService],
})
export class UsersModule {}
