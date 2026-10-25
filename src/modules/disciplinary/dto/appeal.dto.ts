import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { AppealOutcome } from '../constants/disciplinary.enums';

export class FileRevocationDto {
  @ApiProperty({ minLength: 10, maxLength: 4000 })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  subsidiary?: boolean;
}

export class FileAppealDto {
  @ApiProperty({ minLength: 10, maxLength: 4000 })
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  body!: string;
}

export class ResolveAppealDto {
  @ApiProperty({ enum: AppealOutcome })
  @IsEnum(AppealOutcome)
  outcome!: AppealOutcome;

  @ApiProperty({ minLength: 20, maxLength: 4000 })
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  reasoning!: string;

  @ApiPropertyOptional({ enum: InfractionSeverity })
  @IsOptional()
  @IsEnum(InfractionSeverity)
  severity?: InfractionSeverity;
}
