import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { DisciplinaryCaseStatus } from '../constants/disciplinary.enums';
import { InfractionSeverity } from '../constants/infraction-severity.constant';

export class StudentHistoryQueryDto {
  @ApiPropertyOptional({ enum: DisciplinaryCaseStatus })
  @IsOptional()
  @IsEnum(DisciplinaryCaseStatus)
  status?: DisciplinaryCaseStatus;

  @ApiPropertyOptional({ enum: InfractionSeverity })
  @IsOptional()
  @IsEnum(InfractionSeverity)
  severity?: InfractionSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  academicPeriodId?: number;
}
