import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';

/** Una lección dentro de una celda: materia y, en otra línea, sección y docente. */
export class ScheduleExportEntryDto {
  @ApiProperty({ example: 'Matemáticas' })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ example: '10-1 · María Fernández' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  detail?: string;
}

export class ScheduleExportCellDto {
  @ApiProperty({ type: [ScheduleExportEntryDto] })
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ScheduleExportEntryDto)
  entries!: ScheduleExportEntryDto[];
}

export class ScheduleExportRowDto {
  @ApiProperty({ example: '07:00–07:40' })
  @IsString()
  @MaxLength(40)
  time!: string;

  @ApiPropertyOptional({ example: 'Lección 1' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @ApiProperty({ enum: ScheduleSlotType })
  @IsEnum(ScheduleSlotType)
  kind!: ScheduleSlotType;

  @ApiProperty({
    type: [ScheduleExportCellDto],
    description: 'Una celda por día, de lunes a viernes',
  })
  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ScheduleExportCellDto)
  days!: ScheduleExportCellDto[];
}

/**
 * Cuadrícula del horario tal como se ve en pantalla (mismos filtros). El servidor
 * solo le da formato institucional; no consulta ni modifica datos.
 */
export class ScheduleExportDto {
  @ApiProperty({ example: 'Curso lectivo 2026' })
  @IsString()
  @MaxLength(120)
  periodLabel!: string;

  @ApiPropertyOptional({ example: 'Todos' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  teacherLabel?: string;

  @ApiPropertyOptional({ example: '10-1' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  groupLabel?: string;

  @ApiProperty({ type: [ScheduleExportRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => ScheduleExportRowDto)
  rows!: ScheduleExportRowDto[];
}
