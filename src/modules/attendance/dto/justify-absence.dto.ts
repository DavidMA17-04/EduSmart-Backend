import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class JustifyAbsenceDto {
  @ApiProperty()
  @IsUUID()
  absenceId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  reason!: string;
}
