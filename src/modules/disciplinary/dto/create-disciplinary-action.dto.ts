import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateDisciplinaryActionDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;

  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  description!: string;
}
