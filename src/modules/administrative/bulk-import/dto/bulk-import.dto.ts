import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class BulkImportDto {
  @ApiProperty({ description: 'Identificador del tipo de carga masiva' })
  @IsString()
  type!: string;
}
