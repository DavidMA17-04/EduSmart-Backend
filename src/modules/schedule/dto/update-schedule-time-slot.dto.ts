import { PartialType } from '@nestjs/swagger';
import { CreateScheduleTimeSlotDto } from './create-schedule-time-slot.dto';

export class UpdateScheduleTimeSlotDto extends PartialType(
  CreateScheduleTimeSlotDto,
) {}
