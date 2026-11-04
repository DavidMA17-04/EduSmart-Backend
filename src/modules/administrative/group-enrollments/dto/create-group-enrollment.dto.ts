import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

export class CreateGroupEnrollmentDto {
  @ApiProperty({ description: 'Student user id' })
  @IsInt()
  @Min(1)
  userId!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  groupId!: number;

  @ApiProperty({ example: '2026-02-01' })
  @IsDateString()
  startsOn!: string;

  @ApiPropertyOptional({ example: '2026-04-30' })
  @IsOptional()
  @IsDateString()
  endsOn?: string | null;

  @ApiPropertyOptional({
    description: 'Defaults to the group academic period',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  academicPeriodId?: number;
}
