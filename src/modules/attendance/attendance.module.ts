import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicOfferingsModule } from '../administrative/academic-offerings/academic-offerings.module';
import { GroupEnrollment } from '../administrative/group-enrollments/entities/group-enrollment.entity';
import { TeachingAssignment } from '../administrative/teaching-assignments/entities/teaching-assignment.entity';
import { AuditLog } from '../administrative/users/entities/audit-log.entity';
import { UsersModule } from '../administrative/users/users.module';
import { ScheduleEntry } from '../schedule/entities/schedule-entry.entity';
import { AcademicPeriod } from '../administrative/academic-periods/entities/academic-period.entity';
import { SectionEntity } from '../administrative/sections/entities/section.entity';
import { AttendanceCalendarExceptionsController } from './controllers/attendance-calendar-exceptions.controller';
import { AttendanceController } from './controllers/attendance.controller';
import { JustificationsController } from './controllers/justifications.controller';
import { AbsenceJustification } from './entities/absence-justification.entity';
import { Attendance } from './entities/attendance.entity';
import { AttendanceCalendarException } from './entities/attendance-calendar-exception.entity';
import { AttendanceSession } from './entities/attendance-session.entity';
import { GuardianStudentLink } from './entities/guardian-student-link.entity';
import { JustificationEvidence } from './entities/justification-evidence.entity';
import { AttendanceCalendarExceptionsService } from './services/attendance-calendar-exceptions.service';
import { AttendanceExportService } from './services/attendance-export.service';
import { AttendanceHistoryService } from './services/attendance-history.service';
import { AttendanceRecordsService } from './services/attendance-records.service';
import { AttendanceSessionsService } from './services/attendance-sessions.service';
import { AttendanceTokenService } from './services/attendance-token.service';
import { JustificationsService } from './services/justifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttendanceSession,
      Attendance,
      AttendanceCalendarException,
      AbsenceJustification,
      JustificationEvidence,
      GuardianStudentLink,
      TeachingAssignment,
      GroupEnrollment,
      AuditLog,
      ScheduleEntry,
      AcademicPeriod,
      SectionEntity,
    ]),
    AcademicOfferingsModule,
    UsersModule,
  ],
  controllers: [
    AttendanceController,
    JustificationsController,
    AttendanceCalendarExceptionsController,
  ],
  providers: [
    AttendanceSessionsService,
    AttendanceRecordsService,
    AttendanceHistoryService,
    AttendanceTokenService,
    AttendanceExportService,
    JustificationsService,
    AttendanceCalendarExceptionsService,
  ],
  exports: [
    AttendanceSessionsService,
    AttendanceRecordsService,
    AttendanceHistoryService,
    AttendanceTokenService,
    JustificationsService,
    AttendanceCalendarExceptionsService,
  ],
})
export class AttendanceModule {}
