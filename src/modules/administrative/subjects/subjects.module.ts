import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubjectsController } from './controllers/subjects.controller';
import { SubjectEntity } from './entities/subject.entity';
import { SubjectsRepository } from './repositories/subjects.repository';
import { SubjectsService } from './services/subjects.service';

@Module({
  imports: [TypeOrmModule.forFeature([SubjectEntity])],
  controllers: [SubjectsController],
  providers: [SubjectsService, SubjectsRepository],
  exports: [SubjectsService, SubjectsRepository],
})
export class SubjectsModule {}
