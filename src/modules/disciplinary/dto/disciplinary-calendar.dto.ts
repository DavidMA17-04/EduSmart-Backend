import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateNonWorkingDayDto {
  @ApiProperty({ example: '2026-12-25' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day!: string;

  @ApiProperty({ minLength: 2, maxLength: 200 })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason!: string;
}

export class UpdateDisciplinarySettingsDto {
  @ApiProperty({ minimum: 1, maximum: 50, default: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  recidivismThreshold!: number;

  @ApiProperty({ minimum: 0, maximum: 100, default: 80 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  conductAlertThreshold!: number;
}
