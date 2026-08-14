import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResolveAppealDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  resolution!: string;

  @ApiProperty({ example: 'APPROVED' })
  @IsString()
  outcome!: string;
}
