import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpecialtyEntity } from './entities/specialty.entity';
import { SpecialtiesService } from './services/specialties.service';
import { SpecialtiesRepository } from './repositories/specialties.repository';
import { SpecialtiesController } from './controllers/specialties.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SpecialtyEntity])],
  controllers: [SpecialtiesController],
  providers: [SpecialtiesService, SpecialtiesRepository],
  exports: [SpecialtiesService, SpecialtiesRepository],
})
export class SpecialtiesModule {}
