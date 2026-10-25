import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { AppealKind, AppealOutcome } from '../constants/disciplinary.enums';
import { DeadlineIndicator } from '../services/case-read';

export enum AppealOutcomeFilter {
  PENDING = 'PENDING',
  UPHOLD = AppealOutcome.UPHOLD,
  REVOKE = AppealOutcome.REVOKE,
  MODIFY = AppealOutcome.MODIFY,
}

export class ListDisciplinaryAppealsQueryDto {
  @ApiPropertyOptional({ enum: AppealKind })
  @IsOptional()
  @IsEnum(AppealKind)
  kind?: AppealKind;

  @ApiPropertyOptional({ enum: AppealOutcomeFilter })
  @IsOptional()
  @IsEnum(AppealOutcomeFilter)
  outcome?: AppealOutcomeFilter;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  caseId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentUserId?: number;

  @ApiPropertyOptional({
    enum: [DeadlineIndicator.ON_TIME, DeadlineIndicator.DUE_SOON, DeadlineIndicator.OVERDUE, DeadlineIndicator.NONE],
  })
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
