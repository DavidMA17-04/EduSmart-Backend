import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AttendanceRegistrationMethod } from '../../../common/enums/attendance-registration-method.enum';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';

function emptyToUndefined({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return value;
}

export const ATTENDANCE_HISTORY_SORT_FIELDS = [
  'sessionDate',
  'registeredAt',
  'studentName',
  'status',
] as const;

export type AttendanceHistorySortBy =
  (typeof ATTENDANCE_HISTORY_SORT_FIELDS)[number];

export class AttendanceHistoryFilterDto {
  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
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

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  teachingAssignmentId?: number;

  @ApiPropertyOptional({ example: 501 })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId?: number;

  @ApiPropertyOptional({ enum: AttendanceStatus })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional({ enum: AttendanceRegistrationMethod })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEnum(AttendanceRegistrationMethod)
  registrationMethod?: AttendanceRegistrationMethod;

  @ApiPropertyOptional({ example: 'Pérez' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed === '' ? undefined : trimmed;
    }
    return value;
  })
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: ATTENDANCE_HISTORY_SORT_FIELDS })
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsIn([...ATTENDANCE_HISTORY_SORT_FIELDS])
  sortBy?: AttendanceHistorySortBy;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'] })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'string') return value.toUpperCase();
    return value;
  })
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
