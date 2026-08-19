import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserStatus } from '../../../../common/enums/user-status.enum';

const NATIONAL_ID_PATTERN = /^[0-9]{9,12}$/;

export class CreateUserDto {
  @ApiProperty({ example: '109870543', description: 'Cédula o DIMEX (9 a 12 dígitos)' })
  @IsString()
  @Matches(NATIONAL_ID_PATTERN, {
    message: 'nationalId must contain 9 to 12 digits',
  })
  nationalId!: string;

  @ApiProperty({ example: 'María' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Vargas Soto' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  lastName!: string;

  @ApiProperty({ example: 'maria.vargas@ctphojancha.ed.cr' })
  @IsEmail()
  @MaxLength(150)
  email!: string;

  @ApiPropertyOptional({ example: '2665-0000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({
    minLength: 8,
    description: 'Contraseña inicial. Si se omite, la cuenta queda sin hash de acceso.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  @ApiPropertyOptional({ enum: UserStatus, default: UserStatus.ACTIVE })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'IDs de roles institucionales (una persona puede tener más de un rol)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  roleIds?: string[];

  @ApiPropertyOptional({
    description: 'Nombre de visualización. Si se omite se arma con nombre y apellidos.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;
}
