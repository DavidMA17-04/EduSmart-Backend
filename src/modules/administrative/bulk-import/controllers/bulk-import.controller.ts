import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BulkImportService } from '../services/bulk-import.service';
import { BulkImportDto } from '../dto/bulk-import.dto';

@ApiTags('Administrative - BulkImport')
@ApiBearerAuth()
@Controller('bulk-import')
export class BulkImportController {
  constructor(private readonly service: BulkImportService) {}

  @Post()
  @ApiOperation({ summary: 'Carga masiva (stub)' })
  importData(@Body() dto: BulkImportDto) {
    return this.service.importData(dto);
  }
}
