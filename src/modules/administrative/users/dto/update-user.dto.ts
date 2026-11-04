import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['groupId'] as const)) {
  @ApiPropertyOptional({
    example: 12,
    description:
      'Sección a matricular solo si el usuario es Estudiante ACTIVE y aún no tiene matrícula. No transfiere entre secciones.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  groupId?: number;

  @ApiPropertyOptional({
    example: 'Traslado a otra institución',
    description:
      'Motivo de baja. Obligatorio cuando el estado pasa a INACTIVE (auditoría de inactivación).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Alias de reason para clientes que envían deactivationReason',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deactivationReason?: string;
}
