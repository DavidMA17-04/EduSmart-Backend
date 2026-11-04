import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';

const TIME_HH_MM_SS = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class CreateScheduleTimeSlotDto {
  @ApiPropertyOptional({ description: 'Lesson number for CLASS slots; null for BREAK/LUNCH' })
  @IsOptional()
  @IsInt()
  @Min(1)
  lessonNumber?: number | null;

  @ApiProperty({ example: 'Lección 1' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: '07:00:00' })
  @IsString()
  @Matches(TIME_HH_MM_SS, { message: 'startTime must be HH:mm or HH:mm:ss' })
  startTime!: string;

  @ApiProperty({ example: '07:40:00' })
  @IsString()
  @Matches(TIME_HH_MM_SS, { message: 'endTime must be HH:mm or HH:mm:ss' })
  endTime!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  displayOrder!: number;

  @ApiProperty({ enum: ScheduleSlotType })
  @IsEnum(ScheduleSlotType)
  slotType!: ScheduleSlotType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
