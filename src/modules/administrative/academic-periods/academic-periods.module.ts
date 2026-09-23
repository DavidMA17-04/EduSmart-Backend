import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicYear } from '../academic-years/entities/academic-year.entity';
import { AcademicYearsModule } from '../academic-years/academic-years.module';
import { AcademicPeriodsController } from './controllers/academic-periods.controller';
import { AcademicPeriod } from './entities/academic-period.entity';
import { AcademicPeriodsRepository } from './repositories/academic-periods.repository';
import { AcademicPeriodsService } from './services/academic-periods.service';

@Module({
  imports: [TypeOrmModule.forFeature([AcademicPeriod, AcademicYear]), AcademicYearsModule],
  controllers: [AcademicPeriodsController],
  providers: [AcademicPeriodsService, AcademicPeriodsRepository],
  exports: [AcademicPeriodsService, AcademicPeriodsRepository],
})
export class AcademicPeriodsModule {}
