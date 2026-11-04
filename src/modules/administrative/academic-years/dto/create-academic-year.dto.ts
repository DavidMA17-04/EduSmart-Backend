import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAcademicYearDto {
  @ApiProperty({ example: 'Año 2026', description: 'Nombre del año lectivo' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: '2026-02-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-12-15' })
  @IsDateString()
  endDate!: string;
}
