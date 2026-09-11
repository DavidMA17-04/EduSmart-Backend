import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class CreateScheduleEntryDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  teachingAssignmentId!: number;

  @ApiProperty({ description: '1=Monday … 5=Friday', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  dayOfWeek!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  timeSlotId!: number;
}
