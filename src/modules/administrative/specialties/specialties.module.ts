import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpecialtyEntity } from './entities/specialty.entity';
import { SpecialtyHubCoverEntity } from './entities/specialty-hub-cover.entity';
import { SpecialtiesService } from './services/specialties.service';
import { SpecialtyHubService } from './services/specialty-hub.service';
import { SpecialtiesRepository } from './repositories/specialties.repository';
import { SpecialtiesController } from './controllers/specialties.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SpecialtyEntity, SpecialtyHubCoverEntity])],
  controllers: [SpecialtiesController],
  providers: [SpecialtiesService, SpecialtyHubService, SpecialtiesRepository],
  exports: [SpecialtiesService, SpecialtiesRepository],
})
export class SpecialtiesModule {}
