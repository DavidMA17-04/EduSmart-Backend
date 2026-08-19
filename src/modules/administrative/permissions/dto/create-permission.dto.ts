import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PermissionAction } from '../../../../common/enums/permission-action.enum';
import { PermissionModule } from '../../../../common/enums/permission-module.enum';

export class CreatePermissionDto {
  @ApiPropertyOptional({
    example: 'attendance.view',
    description:
      'Código estable para guards. Si se omite, el servicio lo derivará de module.action',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, {
    message:
      'code must be lowercase alphanumeric segments separated by ., _ or -',
  })
  code?: string;

  @ApiProperty({ enum: PermissionModule, example: PermissionModule.ATTENDANCE })
  @IsEnum(PermissionModule)
  module!: PermissionModule;

  @ApiProperty({ enum: PermissionAction, example: PermissionAction.VIEW })
  @IsEnum(PermissionAction)
  action!: PermissionAction;

  @ApiPropertyOptional({ example: 'Permite consultar registros de asistencia' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
