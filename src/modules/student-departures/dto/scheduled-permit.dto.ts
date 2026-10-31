import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ScheduledPermitStatus } from '../entities/scheduled-departure-permit.entity';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class CreateScheduledPermitDto {
  @ApiProperty({ description: 'Cédula o ID del estudiante' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Ingrese la cédula del estudiante.' })
  @MaxLength(30)
  studentIdentifier!: string;

  @ApiProperty({ example: '2026-10-30' })
  @IsDateString({ strict: true }, { message: 'Fecha del permiso inválida.' })
  permitDate!: string;

  @ApiProperty({ example: '13:30' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Hora inválida (use HH:mm).' })
  departureTime!: string;

  @ApiProperty({ example: 'Cita médica en la CCSS' })
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Indique el motivo del permiso.' })
  @MaxLength(255)
  reason!: string;
}

export class ScheduledPermitFilterDto {
  @ApiPropertyOptional({ description: 'YYYY-MM-DD (por defecto hoy)' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsDateString({ strict: true })
  date?: string;

  @ApiPropertyOptional({ enum: ScheduledPermitStatus })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEnum(ScheduledPermitStatus)
  status?: ScheduledPermitStatus;
}
