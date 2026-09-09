import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({ example: 'usuario@ctphojancha.ed.cr' })
  @IsEmail()
  email!: string;
}
