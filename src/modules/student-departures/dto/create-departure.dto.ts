import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID, Matches, ValidateIf } from 'class-validator';
import { DepartureStatus, DepartureType } from '../entities/student-departure.entity';
import { ValidateGuardianDto } from './validate-guardian.dto';

const trimOrUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class CreateDepartureDto extends ValidateGuardianDto {
  @ApiPropertyOptional({ enum: DepartureStatus, default: DepartureStatus.AUTHORIZED })
  @IsOptional()
  @IsEnum(DepartureStatus)
  decision?: DepartureStatus;

  @ApiPropertyOptional({ enum: DepartureType, default: DepartureType.REGULAR })
  @IsOptional()
  @IsEnum(DepartureType)
  departureType?: DepartureType;

  @ApiPropertyOptional({ description: 'Obligatorio en emergencias y al rechazar manualmente' })
  @Transform(trimOrUndefined)
  @ValidateIf(
    (dto: CreateDepartureDto) =>
      dto.departureType === DepartureType.EMERGENCY ||
      dto.decision === DepartureStatus.REJECTED ||
      dto.justificationReason !== undefined,
  )
  // Una sola regla para un único mensaje claro (también cuando falta el valor).
  @Matches(/^[\s\S]{5,1000}$/, {
    message: 'Indique el motivo de la salida (entre 5 y 1000 caracteres).',
  })
  justificationReason?: string;

  @ApiPropertyOptional({ description: 'Permiso programado que se cumple con esta salida' })
  @IsOptional()
  @IsUUID('all', { message: 'Permiso programado inválido.' })
  scheduledPermitId?: string;
}

export class CreateDepartureResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: DepartureStatus }) status!: DepartureStatus;
}
