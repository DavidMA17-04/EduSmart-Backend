import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../administrative/users/entities/audit-log.entity';
import { ScheduledPermitsController } from './controllers/scheduled-permits.controller';
import { StudentDeparturesController } from './controllers/student-departures.controller';
import { ScheduledDeparturePermit } from './entities/scheduled-departure-permit.entity';
import { StudentDeparture } from './entities/student-departure.entity';
import { DeparturesRepository } from './repositories/departures.repository';
import { DepartureValidationService } from './services/departure-validation.service';
import { ScheduledPermitsService } from './services/scheduled-permits.service';
import { StudentDeparturesExportService } from './services/student-departures-export.service';
import { StudentDeparturesService } from './services/student-departures.service';

@Module({
  imports: [TypeOrmModule.forFeature([StudentDeparture, ScheduledDeparturePermit, AuditLog])],
  controllers: [StudentDeparturesController, ScheduledPermitsController],
  providers: [
    DeparturesRepository,
    DepartureValidationService,
    StudentDeparturesService,
    StudentDeparturesExportService,
    ScheduledPermitsService,
  ],
})
export class StudentDeparturesModule {}
