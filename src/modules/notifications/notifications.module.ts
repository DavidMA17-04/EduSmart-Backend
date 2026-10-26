import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { DisciplinaryModule } from '../disciplinary/disciplinary.module';
import { InboxNotificationsService } from './inbox-notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [DisciplinaryModule, AttendanceModule],
  controllers: [NotificationsController],
  providers: [InboxNotificationsService],
})
export class NotificationsModule {}
