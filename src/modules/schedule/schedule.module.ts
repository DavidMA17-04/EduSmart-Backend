import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicOfferingsModule } from '../administrative/academic-offerings/academic-offerings.module';
import { GroupEnrollmentsModule } from '../administrative/group-enrollments/group-enrollments.module';
import { TeachingAssignment } from '../administrative/teaching-assignments/entities/teaching-assignment.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import { ScheduleEntriesController } from './controllers/schedule-entries.controller';
import { ScheduleMyScheduleController } from './controllers/schedule-my-schedule.controller';
import { ScheduleTimeSlotsController } from './controllers/schedule-time-slots.controller';
import { ScheduleEntry } from './entities/schedule-entry.entity';
import { ScheduleTimeSlot } from './entities/schedule-time-slot.entity';
import { ScheduleEntriesService } from './services/schedule-entries.service';
import { ScheduleTimeSlotsService } from './services/schedule-time-slots.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ScheduleTimeSlot,
      ScheduleEntry,
      TeachingAssignment,
      AttendanceSession,
    ]),
    AcademicOfferingsModule,
    GroupEnrollmentsModule,
  ],
  controllers: [
    ScheduleTimeSlotsController,
    ScheduleEntriesController,
    ScheduleMyScheduleController,
  ],
  providers: [ScheduleTimeSlotsService, ScheduleEntriesService],
  exports: [ScheduleTimeSlotsService, ScheduleEntriesService],
})
export class ScheduleModule {}
