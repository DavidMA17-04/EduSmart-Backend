import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
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
