import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SpecialtyStatus } from '../../../../common/enums/specialty-status.enum';

export class CreateSpecialtyDto {
  @ApiProperty({ example: 'INF-01', maxLength: 20 })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, {
    message: 'code must be uppercase alphanumeric segments separated by -',
  })
  code!: string;

  @ApiProperty({ example: 'Informática', maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 'Tecnología', maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  area!: string;

  @ApiPropertyOptional({
    example: 'Especialidad orientada al desarrollo de software',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    example: 6,
    description: 'Duración en semestres / períodos académicos',
  })
  @IsInt()
  @Min(1)
  @Max(20)
  duration!: number;

  @ApiPropertyOptional({
    enum: SpecialtyStatus,
    default: SpecialtyStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SpecialtyStatus)
  status?: SpecialtyStatus;
}
