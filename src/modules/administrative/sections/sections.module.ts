import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicPeriodsModule } from '../academic-periods/academic-periods.module';
import { SpecialtiesModule } from '../specialties/specialties.module';
import { TeachingAssignment } from '../teaching-assignments/entities/teaching-assignment.entity';
import { User } from '../users/entities/user.entity';
import { GroupsController } from './controllers/groups.controller';
import { SectionsController } from './controllers/sections.controller';
import { GroupEntity } from './entities/group.entity';
import { SectionEntity } from './entities/section.entity';
import { GroupsRepository } from './repositories/groups.repository';
import { SectionsRepository } from './repositories/sections.repository';
import { GroupsService } from './services/groups.service';
import { SectionsService } from './services/sections.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SectionEntity,
      GroupEntity,
      User,
      TeachingAssignment,
    ]),
    AcademicPeriodsModule,
    SpecialtiesModule,
  ],
  controllers: [SectionsController, GroupsController],
  providers: [
    SectionsService,
    SectionsRepository,
    GroupsService,
    GroupsRepository,
  ],
  exports: [
    SectionsService,
    SectionsRepository,
    GroupsService,
    GroupsRepository,
  ],
})
export class SectionsModule {}
