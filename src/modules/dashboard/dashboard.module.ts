import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../administrative/users/entities/user.entity';
import { RoleEntity } from '../administrative/roles/entities/role.entity';
import { AcademicPeriod } from '../administrative/academic-periods/entities/academic-period.entity';
import { UserRoleEntity } from '../administrative/users/entities/user-role.entity';
import { SectionEntity } from '../administrative/sections/entities/section.entity';
import { SpecialtyEntity } from '../administrative/specialties/entities/specialty.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      RoleEntity,
      AcademicPeriod,
      UserRoleEntity,
      SectionEntity,
      SpecialtyEntity,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
