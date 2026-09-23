import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AttendanceCalendarExceptionType } from '../../../common/enums/attendance-calendar-exception-type.enum';

export class CreateAttendanceCalendarExceptionDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  academicPeriodId!: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Optional section scope; omit for whole period',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  sectionId?: number | null;

  @ApiProperty({ example: 'Semana de Exámenes I Período' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'Clases lectivas suspendidas por evaluaciones' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ example: '2026-05-12' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-05-16' })
  @IsDateString()
  endDate!: string;

  @ApiProperty({ enum: AttendanceCalendarExceptionType })
  @IsEnum(AttendanceCalendarExceptionType)
  exceptionType!: AttendanceCalendarExceptionType;
}
