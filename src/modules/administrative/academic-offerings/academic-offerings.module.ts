import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupEntity } from '../sections/entities/group.entity';
import { SpecialtyEntity } from '../specialties/entities/specialty.entity';
import { SubjectEntity } from '../subjects/entities/subject.entity';
import { AcademicOfferingEligibilityService } from './services/academic-offering-eligibility.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupEntity, SubjectEntity, SpecialtyEntity]),
  ],
  providers: [AcademicOfferingEligibilityService],
  exports: [AcademicOfferingEligibilityService],
})
export class AcademicOfferingsModule {}
