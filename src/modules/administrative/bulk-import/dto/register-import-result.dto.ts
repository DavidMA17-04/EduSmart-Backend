import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ImportErrorRecordDto } from './import-error-record.dto';
import { ImportSuccessRecordDto } from './import-success-record.dto';
import { ImportSummaryDto } from './import-summary.dto';

/**
 * Permite registrar el resultado de una importación ya procesada.
 * No recibe ni procesa archivos Excel: el motor de importación (futuro PBI)
 * será quien produzca estas colecciones.
 */
export class RegisterImportResultDto {
  @ApiPropertyOptional({ example: 'users', description: 'Tipo de carga (usuarios, etc.)' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ type: [ImportSuccessRecordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportSuccessRecordDto)
  successfulRecords!: ImportSuccessRecordDto[];

  @ApiProperty({ type: [ImportErrorRecordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportErrorRecordDto)
  errorRecords!: ImportErrorRecordDto[];

  @ApiPropertyOptional({
    type: ImportSummaryDto,
    description: 'Si se omite, se calcula a partir de las colecciones',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ImportSummaryDto)
  summary?: ImportSummaryDto;
}
