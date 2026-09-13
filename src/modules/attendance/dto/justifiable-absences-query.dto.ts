import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class JustifiableAbsencesQueryDto {
  @ApiPropertyOptional({
    description:
      'Student user id. Only usable with attendance.review; otherwise the actor scope applies',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentUserId?: number;
}
