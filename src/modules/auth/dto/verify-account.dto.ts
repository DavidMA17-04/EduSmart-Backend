import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class VerifyAccountDto {
  @ApiProperty({ example: 'usuario@ctphojancha.ed.cr' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', description: 'Código numérico de 6 dígitos' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
  code!: string;
}
