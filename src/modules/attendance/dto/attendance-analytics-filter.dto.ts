import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return value;
}

/** Shared query filters for WF-43 reports and WF-44 dashboard KPIs. */
export class AttendanceAnalyticsFilterDto {
  @ApiPropertyOptional({ example: '2026-02-01' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId?: number;

  /** Subject id (`subjects`) — equivalent to courseId in the product spec. */
  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  courseId?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  academicPeriodId?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teachingAssignmentId?: number;

  @ApiPropertyOptional({ enum: AttendanceStatus })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;
}
