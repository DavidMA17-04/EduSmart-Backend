import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisciplinaryAction } from './entities/disciplinary-action.entity';
import { DisciplinaryFollowUp } from './entities/disciplinary-follow-up.entity';
import { DisciplinaryController } from './controllers/disciplinary.controller';
import { DisciplinaryService } from './services/disciplinary.service';
import { DisciplinaryFollowUpService } from './services/disciplinary-follow-up.service';
import { DisciplinaryRepository } from './repositories/disciplinary.repository';

@Module({
  imports: [TypeOrmModule.forFeature([DisciplinaryAction, DisciplinaryFollowUp])],
  controllers: [DisciplinaryController],
  providers: [DisciplinaryService, DisciplinaryFollowUpService, DisciplinaryRepository],
  exports: [DisciplinaryService, DisciplinaryFollowUpService],
})
export class DisciplinaryModule {}
