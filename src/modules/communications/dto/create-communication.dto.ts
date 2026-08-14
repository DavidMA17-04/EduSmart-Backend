import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateCommunicationDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  body!: string;
}
