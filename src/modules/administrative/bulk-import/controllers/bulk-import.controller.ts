import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BulkImportService } from '../services/bulk-import.service';
import { BulkImportDto } from '../dto/bulk-import.dto';
import { RegisterImportResultDto } from '../dto/register-import-result.dto';

@ApiTags('Administrative - BulkImport')
@ApiBearerAuth()
@Controller('bulk-import')
export class BulkImportController {
  constructor(private readonly service: BulkImportService) {}

  @Post()
  @ApiOperation({ summary: 'Carga masiva (stub: motor Excel pendiente)' })
  importData(@Body() dto: BulkImportDto) {
    return this.service.importData(dto);
  }

  @Post('results')
  @ApiOperation({
    summary: 'Registrar resultado de importación (PBI-06)',
    description:
      'Guarda el contrato de resultado. No procesa Excel; el origen futuro será el motor de importación.',
  })
  registerResult(@Body() dto: RegisterImportResultDto) {
    return this.service.registerResult(dto);
  }

  @Get(':jobId')
  @ApiOperation({ summary: 'Consultar resultado de importación (WF-16)' })
  findResult(@Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.service.findResult(jobId);
  }
}
