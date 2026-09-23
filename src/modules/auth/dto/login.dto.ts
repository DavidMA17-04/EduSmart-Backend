import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

/** Cédula / DIMEX: solo dígitos, 9 a 12. */
const NATIONAL_ID_PATTERN = /^[0-9]{9,12}$/;

export class LoginDto {
  @ApiProperty({
    example: '100000000',
    description: 'Número de cédula o DIMEX (national_id). No se acepta correo electrónico.',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(NATIONAL_ID_PATTERN, {
    message: 'identifier must be a national ID with 9 to 12 digits',
  })
  identifier!: string;

  @ApiProperty({ example: 'Admin1234' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Si es true, el access token usa TTL prolongado',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
