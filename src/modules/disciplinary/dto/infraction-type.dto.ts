import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { InfractionSeverity } from '../constants/infraction-severity.constant';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateInfractionTypeDto {
  @ApiProperty({ example: 'Uso del celular en clase sin autorización', maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: InfractionSeverity })
  @IsEnum(InfractionSeverity)
  severity!: InfractionSeverity;

  @ApiPropertyOptional({ example: 'REAC Art. 154', maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  legalReference?: string;
}

export class UpdateInfractionTypeDto extends PartialType(CreateInfractionTypeDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListInfractionTypesQueryDto {
  @ApiPropertyOptional({ enum: InfractionSeverity })
  @IsOptional()
  @IsEnum(InfractionSeverity)
  severity?: InfractionSeverity;

  @ApiPropertyOptional({ description: 'true = solo activos, false = solo inactivos' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  active?: boolean;
}
