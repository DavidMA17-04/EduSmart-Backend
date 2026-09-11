import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicOfferingsModule } from '../academic-offerings/academic-offerings.module';
import { GroupEntity } from '../sections/entities/group.entity';
import { User } from '../users/entities/user.entity';
import { TeachingAssignmentsController } from './controllers/teaching-assignments.controller';
import { TeachingAssignment } from './entities/teaching-assignment.entity';
import { TeachingAssignmentsService } from './services/teaching-assignments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeachingAssignment, GroupEntity, User]),
    AcademicOfferingsModule,
  ],
  controllers: [TeachingAssignmentsController],
  providers: [TeachingAssignmentsService],
  exports: [TeachingAssignmentsService, TypeOrmModule],
})
export class TeachingAssignmentsModule {}
