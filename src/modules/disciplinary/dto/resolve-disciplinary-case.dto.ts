import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { ResolutionOutcome } from '../constants/disciplinary.enums';

export class ResolveDisciplinaryCaseDto {
  @ApiProperty({ enum: ResolutionOutcome })
  @IsEnum(ResolutionOutcome)
  outcome!: ResolutionOutcome;

  @ApiProperty({ minLength: 50, maxLength: 4000 })
  @IsString()
  @MinLength(50)
  @MaxLength(4000)
  reasoning!: string;

  @ApiPropertyOptional({ enum: InfractionSeverity, description: 'Obligatoria cuando el resultado es Modifica' })
  @IsOptional()
  @IsEnum(InfractionSeverity)
  severity?: InfractionSeverity;
}
