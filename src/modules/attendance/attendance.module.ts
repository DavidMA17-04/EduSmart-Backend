import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from './entities/attendance.entity';
import { Absence } from './entities/absence.entity';
import { AbsenceJustification } from './entities/absence-justification.entity';
import { AttendanceController } from './controllers/attendance.controller';
import { JustificationsController } from './controllers/justifications.controller';
import { AttendanceService } from './services/attendance.service';
import { AbsencesService } from './services/absences.service';
import { JustificationsService } from './services/justifications.service';
import { AttendanceRepository } from './repositories/attendance.repository';
import { JustificationsRepository } from './repositories/justifications.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Attendance, Absence, AbsenceJustification])],
  controllers: [AttendanceController, JustificationsController],
  providers: [
    AttendanceService,
    AbsencesService,
    JustificationsService,
    AttendanceRepository,
    JustificationsRepository,
  ],
  exports: [AttendanceService, AbsencesService, JustificationsService],
})
export class AttendanceModule {}
