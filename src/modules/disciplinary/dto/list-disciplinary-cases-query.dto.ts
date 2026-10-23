import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { DisciplinaryCaseStatus } from '../constants/disciplinary.enums';
import { DeadlineIndicator } from '../services/case-read';

export class ListDisciplinaryCasesQueryDto {
  @ApiPropertyOptional({ enum: DisciplinaryCaseStatus })
  @IsOptional()
  @IsEnum(DisciplinaryCaseStatus)
  status?: DisciplinaryCaseStatus;

  @ApiPropertyOptional({ enum: InfractionSeverity })
  @IsOptional()
  @IsEnum(InfractionSeverity)
  severity?: InfractionSeverity;

  @ApiPropertyOptional({ description: 'Sección (id de grupo)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  academicPeriodId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentUserId?: number;

  @ApiPropertyOptional({ enum: [DeadlineIndicator.ON_TIME, DeadlineIndicator.DUE_SOON, DeadlineIndicator.OVERDUE] })
  @IsOptional()
  @IsEnum(DeadlineIndicator)
  deadline?: DeadlineIndicator;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
