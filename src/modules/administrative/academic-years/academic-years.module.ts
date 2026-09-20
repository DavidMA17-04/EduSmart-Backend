import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicYearsController } from './controllers/academic-years.controller';
import { AcademicYear } from './entities/academic-year.entity';
import { AcademicYearsRepository } from './repositories/academic-years.repository';
import { AcademicYearsService } from './services/academic-years.service';

@Module({
  imports: [TypeOrmModule.forFeature([AcademicYear])],
  controllers: [AcademicYearsController],
  providers: [AcademicYearsService, AcademicYearsRepository],
  exports: [AcademicYearsService, AcademicYearsRepository],
})
export class AcademicYearsModule {}
