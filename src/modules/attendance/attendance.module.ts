import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicOfferingsModule } from '../administrative/academic-offerings/academic-offerings.module';
import { GroupEnrollment } from '../administrative/group-enrollments/entities/group-enrollment.entity';
import { TeachingAssignment } from '../administrative/teaching-assignments/entities/teaching-assignment.entity';
import { AuditLog } from '../administrative/users/entities/audit-log.entity';
import { UsersModule } from '../administrative/users/users.module';
import { ScheduleEntry } from '../schedule/entities/schedule-entry.entity';
import { AttendanceController } from './controllers/attendance.controller';
import { JustificationsController } from './controllers/justifications.controller';
import { AbsenceJustification } from './entities/absence-justification.entity';
import { Attendance } from './entities/attendance.entity';
import { AttendanceSession } from './entities/attendance-session.entity';
import { GuardianStudentLink } from './entities/guardian-student-link.entity';
import { JustificationEvidence } from './entities/justification-evidence.entity';
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
      AbsenceJustification,
      JustificationEvidence,
      GuardianStudentLink,
      TeachingAssignment,
      GroupEnrollment,
      AuditLog,
      ScheduleEntry,
    ]),
    AcademicOfferingsModule,
    UsersModule,
  ],
  controllers: [AttendanceController, JustificationsController],
  providers: [
    AttendanceSessionsService,
    AttendanceRecordsService,
    AttendanceHistoryService,
    AttendanceTokenService,
    AttendanceExportService,
    JustificationsService,
  ],
  exports: [
    AttendanceSessionsService,
    AttendanceRecordsService,
    AttendanceHistoryService,
    AttendanceTokenService,
    JustificationsService,
  ],
})
export class AttendanceModule {}
