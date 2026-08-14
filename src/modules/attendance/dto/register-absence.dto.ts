import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class RegisterAbsenceDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;

  @ApiProperty()
  @IsDateString()
  absenceDate!: string;
}
