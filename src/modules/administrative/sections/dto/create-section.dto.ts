import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SectionStatus } from '../../../../common/enums/section-status.enum';

export class CreateSectionDto {
  @ApiProperty({ example: '09', maxLength: 20 })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, {
    message: 'code must contain uppercase letters, numbers, and optional hyphens',
  })
  code!: string;

  @ApiProperty({ example: 'Noveno', maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: 'Nivel de educación básica superior' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    enum: SectionStatus,
    default: SectionStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SectionStatus)
  status?: SectionStatus;
}