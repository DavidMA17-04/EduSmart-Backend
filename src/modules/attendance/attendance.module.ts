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
import { Attendance } from './entities/attendance.entity';
import { AttendanceSession } from './entities/attendance-session.entity';
import { AttendanceRecordsService } from './services/attendance-records.service';
import { AttendanceSessionsService } from './services/attendance-sessions.service';
import { JustificationsService } from './services/justifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttendanceSession,
      Attendance,
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
    JustificationsService,
  ],
  exports: [AttendanceSessionsService, AttendanceRecordsService],
})
export class AttendanceModule {}
