import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class FollowUpDisciplinaryActionDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  notes!: string;
}
