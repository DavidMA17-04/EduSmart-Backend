import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Section } from './entities/section.entity';
import { SectionsService } from './services/sections.service';
import { SectionsRepository } from './repositories/sections.repository';
import { SectionsController } from './controllers/sections.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Section])],
  controllers: [SectionsController],
  providers: [SectionsService, SectionsRepository],
  exports: [SectionsService, SectionsRepository],
})
export class SectionsModule {}
