import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { SectionStatus } from '../../../../common/enums/section-status.enum';

export class CreateSectionDto {
  @ApiProperty({ example: 'Sétimo', maxLength: 150 })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 7, description: 'Grado numérico (7, 8, 9, 10, 11, 12)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  gradeLevel!: number;

  @ApiProperty({ example: 1, description: 'ID del período académico' })
  @Type(() => Number)
  @IsInt()
  academicPeriodId!: number;

  @ApiPropertyOptional({
    example: null,
    nullable: true,
    description: 'Especialidad opcional. Null en grados inferiores.',
  })
  @Transform(({ value }) => (value === '' || value === undefined ? null : value))
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  specialtyId?: number | null;

  @ApiPropertyOptional({ example: 'Nivel de educación general básica' })
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
