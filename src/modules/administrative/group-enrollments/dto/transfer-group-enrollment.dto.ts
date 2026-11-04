import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class TransferGroupEnrollmentDto {
  @ApiProperty({ description: 'Student user id' })
  @IsInt()
  @Min(1)
  userId!: number;

  @ApiProperty({ description: 'New group id' })
  @IsInt()
  @Min(1)
  newGroupId!: number;

  @ApiProperty({
    example: '2026-05-01',
    description: 'First day in the new group; previous enrollment ends the day before',
  })
  @IsDateString()
  effectiveOn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  academicPeriodId?: number;
}
