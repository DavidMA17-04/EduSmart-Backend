import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const NATIONAL_ID_PATTERN = /^[0-9]{9,12}$/;

export class CreateGuideTeacherDto {
  @ApiProperty({ example: '109870543', description: 'Cédula o DIMEX (9 a 12 dígitos)' })
  @IsString()
  @Matches(NATIONAL_ID_PATTERN, {
    message: 'nationalId must contain 9 to 12 digits',
  })
  nationalId!: string;

  @ApiProperty({ example: 'María', description: 'Nombres de pila' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'Vargas', description: 'Primer apellido' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  first_lastname!: string;

  @ApiPropertyOptional({ example: 'Soto', description: 'Segundo apellido (opcional)' })
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
}
