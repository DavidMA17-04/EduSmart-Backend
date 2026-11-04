import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query for GET /schedule/my-schedule.
 * Only periodId / dayOfWeek. teacherId/groupId/userId are NOT whitelisted
 * (ValidationPipe forbidNonWhitelisted → 400 if sent).
 */
export class MyScheduleQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodId?: number;

  @ApiPropertyOptional({ description: '1=Monday … 5=Friday', minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  dayOfWeek?: number;
}
