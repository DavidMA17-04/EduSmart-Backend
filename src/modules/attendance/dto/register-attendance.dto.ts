import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class RegisterAttendanceDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiProperty()
  @IsDateString()
  attendanceDate!: string;

  @ApiProperty({ example: 'PRESENT' })
  @IsString()
  status!: string;
}
