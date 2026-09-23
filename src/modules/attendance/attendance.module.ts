import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicPeriod } from '../administrative/academic-periods/entities/academic-period.entity';
import { AcademicOfferingsModule } from '../administrative/academic-offerings/academic-offerings.module';
import { GroupEnrollment } from '../administrative/group-enrollments/entities/group-enrollment.entity';
import { SectionEntity } from '../administrative/sections/entities/section.entity';
import { TeachingAssignment } from '../administrative/teaching-assignments/entities/teaching-assignment.entity';
import { AuditLog } from '../administrative/users/entities/audit-log.entity';
import { User } from '../administrative/users/entities/user.entity';
import { UsersModule } from '../administrative/users/users.module';
import { ScheduleEntry } from '../schedule/entities/schedule-entry.entity';
import { ScheduleTimeSlot } from '../schedule/entities/schedule-time-slot.entity';
import { AbsenteeismController } from './controllers/absenteeism.controller';
import { AttendanceCalendarExceptionsController } from './controllers/attendance-calendar-exceptions.controller';
import { AttendanceController } from './controllers/attendance.controller';
import { JustificationsController } from './controllers/justifications.controller';
import { AbsenceJustification } from './entities/absence-justification.entity';
import { AbsenteeismAlertNotification } from './entities/absenteeism-alert-notification.entity';
import { AbsenteeismAlertRule } from './entities/absenteeism-alert-rule.entity';
import { AbsenteeismAlert } from './entities/absenteeism-alert.entity';
import { Attendance } from './entities/attendance.entity';
import { AttendanceCalendarException } from './entities/attendance-calendar-exception.entity';
import { AttendanceSession } from './entities/attendance-session.entity';
import { GuardianStudentLink } from './entities/guardian-student-link.entity';
import { JustificationEvidence } from './entities/justification-evidence.entity';
import { AbsenteeismService } from './services/absenteeism.service';
import { AttendanceAnalyticsService } from './services/attendance-analytics.service';
import { AttendanceCalendarExceptionsService } from './services/attendance-calendar-exceptions.service';
import { AttendanceExportService } from './services/attendance-export.service';
import { AttendanceHistoryService } from './services/attendance-history.service';
import { AttendanceRangeExportService } from './services/attendance-range-export.service';
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
      AcademicPeriod,
      AbsenceJustification,
      JustificationEvidence,
      GuardianStudentLink,
      TeachingAssignment,
      GroupEnrollment,
      AuditLog,
      ScheduleEntry,
      SectionEntity,
      ScheduleTimeSlot,
      AbsenteeismAlert,
      AbsenteeismAlertRule,
      AbsenteeismAlertNotification,
      User,
    ]),
    AcademicOfferingsModule,
    UsersModule,
  ],
  controllers: [
    AttendanceController,
    JustificationsController,
    AttendanceCalendarExceptionsController,
    AbsenteeismController,
  ],
  providers: [
    AttendanceSessionsService,
    AttendanceRecordsService,
    AttendanceHistoryService,
    AttendanceTokenService,
    AttendanceExportService,
    AttendanceAnalyticsService,
    AttendanceRangeExportService,
    JustificationsService,
    AttendanceCalendarExceptionsService,
    AbsenteeismService,
  ],
  exports: [
    AttendanceSessionsService,
    AttendanceRecordsService,
    AttendanceHistoryService,
    AttendanceTokenService,
    AttendanceAnalyticsService,
    JustificationsService,
    AttendanceCalendarExceptionsService,
    AbsenteeismService,
  ],
})
export class AttendanceModule {}
