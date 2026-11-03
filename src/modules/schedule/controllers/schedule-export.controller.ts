import { Body, Controller, HttpCode, Post, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { SkipResponseWrap } from '../../../common/decorators/skip-response-wrap.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { ScheduleExportDto } from '../dto/schedule-export.dto';
import { ScheduleExportService } from '../services/schedule-export.service';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Schedule - Export')
@ApiBearerAuth()
@Controller('schedule/export')
export class ScheduleExportController {
  constructor(private readonly exporter: ScheduleExportService) {}

  @Post('excel')
  @HttpCode(200)
  @SkipResponseWrap()
  @Permissions(PERMISSIONS.SCHEDULES_VIEW)
  @ApiOperation({ summary: 'Exportar el horario visible en Excel con formato institucional' })
  @ApiProduces(XLSX_TYPE)
  async excel(@Body() dto: ScheduleExportDto): Promise<StreamableFile> {
    const buffer = await this.exporter.excel(dto);
    return new StreamableFile(buffer, {
      type: XLSX_TYPE,
      disposition: 'attachment; filename="horario.xlsx"',
      length: buffer.length,
    });
  }
}
