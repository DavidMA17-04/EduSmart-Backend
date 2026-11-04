import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class GroupEnrollmentAsOfQueryDto {
  @ApiProperty({ description: 'Student user id', example: 7 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;

  @ApiProperty({ example: '2026-03-15' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    description: 'Optional filter by academic period',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  academicPeriodId?: number;
}
