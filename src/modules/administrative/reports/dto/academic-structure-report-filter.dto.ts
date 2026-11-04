import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { GroupStatus } from '../../../../common/enums/group-status.enum';

function toOptionalInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return typeof value === 'number' ? value : Number(value);
}

export class AcademicStructureReportFilterDto {
  @ApiPropertyOptional({ example: 1, description: 'ID del período académico' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  academicPeriodId?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Grado numérico de la sección (7 a 12)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  gradeLevel?: number;

  @ApiPropertyOptional({ example: 3, description: 'ID de la especialidad' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalInt(value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  specialtyId?: number;

  @ApiPropertyOptional({ enum: GroupStatus, example: GroupStatus.ACTIVE })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return typeof value === 'string' ? value.trim() : value;
  })
  @IsEnum(GroupStatus)
  status?: GroupStatus;
}
