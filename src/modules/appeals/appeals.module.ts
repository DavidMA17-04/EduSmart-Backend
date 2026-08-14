import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appeal } from './entities/appeal.entity';
import { AppealResolution } from './entities/appeal-resolution.entity';
import { AppealsController } from './controllers/appeals.controller';
import { AppealsService } from './services/appeals.service';
import { AppealResolutionService } from './services/appeal-resolution.service';
import { AppealsRepository } from './repositories/appeals.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Appeal, AppealResolution])],
  controllers: [AppealsController],
  providers: [AppealsService, AppealResolutionService, AppealsRepository],
  exports: [AppealsService, AppealResolutionService],
})
export class AppealsModule {}
