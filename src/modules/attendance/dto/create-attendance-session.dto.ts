import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class CreateAttendanceSessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  teachingAssignmentId!: number;
}
