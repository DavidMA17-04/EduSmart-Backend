import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AttendanceCalendarExceptionType } from '../../../common/enums/attendance-calendar-exception-type.enum';

export class UpdateAttendanceCalendarExceptionDto {
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sectionId?: number | null;

  @ApiPropertyOptional({ example: 'Semana de Exámenes I Período (ajuste)' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ example: '2026-05-12' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-05-16' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: AttendanceCalendarExceptionType })
  @IsOptional()
  @IsEnum(AttendanceCalendarExceptionType)
  exceptionType?: AttendanceCalendarExceptionType;
}
