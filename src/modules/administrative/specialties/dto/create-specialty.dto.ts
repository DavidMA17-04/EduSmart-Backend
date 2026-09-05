import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SpecialtyKind } from '../../../../common/enums/specialty-kind.enum';
import { SpecialtyStatus } from '../../../../common/enums/specialty-status.enum';

export class CreateSpecialtyDto {
  @ApiProperty({ example: 'Informática', maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({
    example: 'Especialidad orientada al desarrollo de software',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    enum: SpecialtyStatus,
    default: SpecialtyStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SpecialtyStatus)
  status?: SpecialtyStatus;

  @ApiPropertyOptional({
    enum: SpecialtyKind,
    default: SpecialtyKind.TECHNICAL_SPECIALTY,
  })
  @IsOptional()
  @IsEnum(SpecialtyKind)
  kind?: SpecialtyKind;
}
