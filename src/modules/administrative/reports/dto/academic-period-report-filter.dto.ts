import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, Matches } from 'class-validator';
import { AcademicPeriodStatus } from '../../academic-periods/enums/academic-period-status.enum';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function toOptionalTrimmedString(value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  return value;
}

export class AcademicPeriodReportFilterDto {
  @ApiPropertyOptional({
    enum: AcademicPeriodStatus,
    example: AcademicPeriodStatus.ACTIVE,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalTrimmedString(value))
  @IsEnum(AcademicPeriodStatus)
  status?: AcademicPeriodStatus;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Incluye períodos cuyo startDate sea mayor o igual (YYYY-MM-DD)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalTrimmedString(value))
  @IsDateString()
  @Matches(DATE_ONLY, { message: 'startDate must be in YYYY-MM-DD format' })
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Incluye períodos cuyo endDate sea menor o igual (YYYY-MM-DD)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalTrimmedString(value))
  @IsDateString()
  @Matches(DATE_ONLY, { message: 'endDate must be in YYYY-MM-DD format' })
  endDate?: string;
}
