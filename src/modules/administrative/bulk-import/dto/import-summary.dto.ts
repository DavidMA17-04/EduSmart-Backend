import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/** Totales de una importación. Deben coincidir con las colecciones de éxito y error. */
export class ImportSummaryDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  totalRecords!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  successfulRecords!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  errorRecords!: number;
}
