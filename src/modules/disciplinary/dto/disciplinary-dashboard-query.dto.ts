import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class DisciplinaryDashboardQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  academicPeriodId?: number;

  @ApiPropertyOptional({ description: 'Nivel de la sección' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gradeLevel?: number;

  @ApiPropertyOptional({ description: 'Sección (id de grupo)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId?: number;
}
