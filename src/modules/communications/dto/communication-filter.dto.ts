import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CommunicationPriority, CommunicationStatus } from '../entities/communication.entity';

/**
 * Los query params llegan como texto: `@Type(() => Boolean)` convierte
 * "false" en `true`. Se interpreta explícitamente.
 */
function toBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'si', 'sí'].includes(String(value).trim().toLowerCase());
}

export class CommunicationFilterDto {
  @ApiPropertyOptional({ enum: CommunicationStatus })
  @IsOptional()
  @IsEnum(CommunicationStatus)
  status?: CommunicationStatus;

  @ApiPropertyOptional({ enum: CommunicationPriority })
  @IsOptional()
  @IsEnum(CommunicationPriority)
  priority?: CommunicationPriority;

  @ApiPropertyOptional({ description: 'Búsqueda por texto en título o contenido' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrar solo no leídos' })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar solo urgentes' })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  urgentOnly?: boolean;

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
  limit?: number = 20;
}
