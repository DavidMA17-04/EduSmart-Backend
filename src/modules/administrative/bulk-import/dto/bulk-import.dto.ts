import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export enum UserRoleEnum {
  ESTUDIANTE = 'ESTUDIANTE',
  DOCENTE = 'DOCENTE',
  ADMINISTRATIVO = 'ADMINISTRATIVO',
  DIRECTIVO = 'DIRECTIVO',
}

export type RowValidationStatus = 'VALID' | 'WARNING' | 'ERROR';

export class ImportedUserRowDto {
  @ApiProperty({ example: 1 })
  row!: number;

  @ApiPropertyOptional({ example: 'tmp-1' })
  tempId?: string;

  @ApiProperty({ enum: ['VALID', 'WARNING', 'ERROR'], example: 'VALID' })
  status!: RowValidationStatus;

  @ApiProperty({ example: '504120893' })
  @IsString()
  @IsNotEmpty()
  national_id!: string;

  @ApiProperty({ example: 'Aaron José' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Solano' })
  @IsString()
  @IsNotEmpty()
  first_lastname!: string;

  @ApiPropertyOptional({ example: 'Mendoza' })
  @IsOptional()
  @IsString()
  second_lastname?: string | null;

  @ApiProperty({ example: 'asolano@ctphojancha.ed.cr' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'ESTUDIANTE' })
  @IsString()
  @IsNotEmpty()
  role!: string;

  @ApiPropertyOptional({ example: '11-B' })
  @IsOptional()
  @IsString()
  section?: string | null;

  @ApiPropertyOptional({ example: '8744-1234' })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['Sin observaciones'] })
  observations?: string[];

  @ApiPropertyOptional({ type: [String], example: ['national_id'] })
  invalidFields?: string[];

  @ApiPropertyOptional({ type: [String], example: ['Cédula duplicada en archivo'] })
  errorMessages?: string[];

  @ApiPropertyOptional({ type: [String], example: ['Estudiante sin sección'] })
  warningMessages?: string[];
}

export class BulkImportBreakdownDto {
  @ApiProperty({ example: 4 })
  duplicateNationalId!: number;

  @ApiProperty({ example: 3 })
  duplicateEmail!: number;

  @ApiProperty({ example: 3 })
  requiredFieldsMissing!: number;

  @ApiProperty({ example: 2 })
  invalidEmail!: number;
}

export class KPISummaryDto {
  @ApiProperty({ example: 248 })
  totalRows!: number;

  @ApiProperty({ example: 218 })
  validRows!: number;

  @ApiProperty({ example: 87.9 })
  validPercentage!: number;

  @ApiProperty({ example: 18 })
  warningRows!: number;

  @ApiProperty({ example: 7.3 })
  warningPercentage!: number;

  @ApiProperty({ example: 12 })
  errorRows!: number;

  @ApiProperty({ example: 4.8 })
  errorPercentage!: number;
}

export class ValidateBulkImportResponseDto {
  @ApiProperty({ example: 248 })
  total!: number;

  @ApiProperty({ example: 218 })
  valid!: number;

  @ApiProperty({ example: 87.9 })
  validPercentage!: number;

  @ApiProperty({ example: 18 })
  warnings!: number;

  @ApiProperty({ example: 7.3 })
  warningsPercentage!: number;

  @ApiProperty({ example: 12 })
  errors!: number;

  @ApiProperty({ example: 4.8 })
  errorsPercentage!: number;

  @ApiProperty({ type: BulkImportBreakdownDto })
  breakdown!: BulkImportBreakdownDto;

  @ApiProperty({ type: [ImportedUserRowDto] })
  records!: ImportedUserRowDto[];

  @ApiPropertyOptional({ type: KPISummaryDto })
  kpis?: KPISummaryDto;

  @ApiPropertyOptional({ type: [ImportedUserRowDto] })
  rows?: ImportedUserRowDto[];
}

export class ConfirmBulkImportDto {
  @ApiPropertyOptional({ type: [ImportedUserRowDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportedUserRowDto)
  validRecords?: ImportedUserRowDto[];

  @ApiPropertyOptional({ type: [ImportedUserRowDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportedUserRowDto)
  users?: ImportedUserRowDto[];
}

export class ConfirmBulkImportResponseDto {
  @ApiProperty({ example: 218 })
  importedCount!: number;

  @ApiProperty({ example: 'Se han importado 218 usuarios exitosamente.' })
  message!: string;
}
