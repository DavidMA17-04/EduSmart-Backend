import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DepartureStatus, DepartureType } from '../entities/student-departure.entity';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class DepartureHistoryFilterDto {
  @ApiPropertyOptional({ description: 'Desde (YYYY-MM-DD, hora de Costa Rica)' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Fecha inicial inválida.' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Hasta (YYYY-MM-DD, inclusive)' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsDateString({ strict: true }, { message: 'Fecha final inválida.' })
  endDate?: string;

  @ApiPropertyOptional({ description: 'Solo eventos posteriores a este instante (ISO 8601)' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsDateString({}, { message: 'Instante inválido.' })
  since?: string;

  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId?: number;

  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId?: number;

  @ApiPropertyOptional({ enum: DepartureStatus })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEnum(DepartureStatus)
  status?: DepartureStatus;

  @ApiPropertyOptional({ enum: DepartureType })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEnum(DepartureType)
  departureType?: DepartureType;

  @ApiPropertyOptional({ description: 'Nombre o cédula del estudiante' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
