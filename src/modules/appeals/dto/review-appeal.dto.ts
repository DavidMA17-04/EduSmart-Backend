import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ReviewAppealDto {
  @ApiProperty({ example: 'IN_REVIEW' })
  @IsString()
  status!: string;
}
