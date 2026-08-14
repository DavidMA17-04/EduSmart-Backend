import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateAppealDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  subject!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  description!: string;
}
