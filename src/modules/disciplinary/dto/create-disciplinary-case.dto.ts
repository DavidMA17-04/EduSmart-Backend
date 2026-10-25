import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SearchDisciplinaryStudentsQueryDto {
  @ApiProperty({ minLength: 2, example: 'Pérez' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  q!: string;
}

export class CreateDisciplinaryCaseDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  studentUserId!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  infractionTypeId!: number;

  @ApiProperty({ example: '2026-10-14T15:30:00.000Z' })
  @IsISO8601()
  occurredAt!: string;

  @ApiProperty({ maxLength: 150 })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  place!: string;

  @ApiProperty({ minLength: 20 })
  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  witnesses?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subjectId?: number;

  @ApiPropertyOptional({ description: 'Obligatoria si el reporte grave es extemporáneo' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  lateReportReason?: string;
}
