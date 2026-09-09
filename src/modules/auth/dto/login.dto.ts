import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin@ctphojancha.ed.cr',
    description: 'Correo institucional o cédula (national_id)',
  })
  @IsString()
  @IsNotEmpty()
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
