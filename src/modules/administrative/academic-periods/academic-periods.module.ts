import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicPeriod } from './entities/academic-period.entity';
import { AcademicPeriodsService } from './services/academic-periods.service';
import { AcademicPeriodsRepository } from './repositories/academic-periods.repository';
import { AcademicPeriodsController } from './controllers/academic-periods.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AcademicPeriod])],
  controllers: [AcademicPeriodsController],
  providers: [AcademicPeriodsService, AcademicPeriodsRepository],
  exports: [AcademicPeriodsService, AcademicPeriodsRepository],
})
export class AcademicPeriodsModule {}
