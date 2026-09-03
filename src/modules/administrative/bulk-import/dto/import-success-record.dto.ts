import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Registro que el futuro motor de importación (Excel → NestJS) marcará como correcto.
 * Los campos son opcionales para no acoplar la UI a un layout de columnas todavía inestable.
 */
export class ImportSuccessRecordDto {
  @ApiProperty({ description: 'Número de fila en el origen (p. ej. Excel)', minimum: 1 })
  @IsInt()
  @Min(1)
  rowNumber!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nationalId?: string;

  @ApiPropertyOptional({ description: 'Nombres de pila' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Primer apellido' })
  @IsOptional()
  @IsString()
  first_lastname?: string;

  @ApiPropertyOptional({ description: 'Segundo apellido' })
  @IsOptional()
  @IsString()
  second_lastname?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Rol o código de rol tal como vino en el origen' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: 'ID del usuario creado, cuando el motor de importación lo persista' })
  @IsOptional()
  @IsString()
  userId?: string;
}
