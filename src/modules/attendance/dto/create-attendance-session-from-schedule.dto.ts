import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CreateAttendanceSessionFromScheduleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scheduleEntryId!: number;
}
