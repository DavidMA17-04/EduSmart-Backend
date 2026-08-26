import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

/**
 * Registro que no pudo procesarse. El mensaje y el campo los define el futuro
 * proceso de importación; PBI-06 solo los representa.
 */
export class ImportErrorRecordDto {
  @ApiProperty({ description: 'Número de fila en el origen (p. ej. Excel)', minimum: 1 })
  @IsInt()
  @Min(1)
  rowNumber!: number;

  @ApiPropertyOptional({
    description: 'Datos relevantes de la fila importada, sin un esquema rígido',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, string | undefined>;

  @ApiPropertyOptional({ description: 'Campo que originó el error, si aplica' })
  @IsOptional()
  @IsString()
  field?: string;

  @ApiProperty({ description: 'Motivo reportado por el proceso de importación' })
  @IsString()
  message!: string;
}
