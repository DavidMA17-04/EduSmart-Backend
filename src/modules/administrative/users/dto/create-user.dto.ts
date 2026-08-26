import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserStatus } from '../../../../common/enums/user-status.enum';

const NATIONAL_ID_PATTERN = /^[0-9]{9,12}$/;

export class CreateUserDto {
  @ApiProperty({ example: '109870543', description: 'Cédula o DIMEX (9 a 12 dígitos)' })
  @IsString()
  @Matches(NATIONAL_ID_PATTERN, {
    message: 'nationalId must contain 9 to 12 digits',
  })
  nationalId!: string;

  @ApiPropertyOptional({ example: '109870543' })
  @IsOptional()
  @IsString()
  national_id?: string;

  @ApiPropertyOptional({ example: 'María' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'María' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Vargas' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_lastname?: string;

  @ApiPropertyOptional({ example: 'Vargas Soto' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Soto' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  second_lastname?: string;

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

  @ApiProperty({
    type: [Number],
    description: 'IDs de roles institucionales (obligatorio; al menos uno)',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe asignar al menos un rol' })
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  roleIds!: number[];
}
