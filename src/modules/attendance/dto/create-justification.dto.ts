import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateJustificationDto {
  @ApiProperty({ description: 'id_attendance of an ABSENT mark' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  attendanceId!: number;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  reason!: string;
}
