import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicPeriod } from '../academic-periods/entities/academic-period.entity';
import { RoleEntity } from '../roles/entities/role.entity';
import { GroupEntity } from '../sections/entities/group.entity';
import { SectionEntity } from '../sections/entities/section.entity';
import { SpecialtyEntity } from '../specialties/entities/specialty.entity';
import { TeachingAssignment } from '../teaching-assignments/entities/teaching-assignment.entity';
import { UserRoleEntity } from '../users/entities/user-role.entity';
import { User } from '../users/entities/user.entity';
import { AdministrativeReportsController } from './controllers/administrative-reports.controller';
import { AdministrativeReportsRepository } from './repositories/administrative-reports.repository';
import { AdministrativeReportsService } from './services/administrative-reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserRoleEntity,
      RoleEntity,
      GroupEntity,
      SectionEntity,
      SpecialtyEntity,
      AcademicPeriod,
      TeachingAssignment,
    ]),
  ],
  controllers: [AdministrativeReportsController],
  providers: [AdministrativeReportsService, AdministrativeReportsRepository],
  exports: [AdministrativeReportsService, AdministrativeReportsRepository],
})
export class AdministrativeReportsModule {}
