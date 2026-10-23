import { Controller, Get, Header, Param, ParseIntPipe, Query, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { SkipResponseWrap } from '../../../common/decorators/skip-response-wrap.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { ListDisciplinaryCasesQueryDto } from '../dto/list-disciplinary-cases-query.dto';
import { StudentHistoryQueryDto } from '../dto/student-history-query.dto';
import { DisciplinaryExportService } from '../services/disciplinary-export.service';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Disciplinary - Exportaciones')
@ApiBearerAuth()
@Controller('disciplinary')
export class DisciplinaryExportsController {
  constructor(private readonly exports: DisciplinaryExportService) {}

  @Get('cases/export/excel')
  @Permissions(PERMISSIONS.DISCIPLINARY_EXPORT)
  @SkipResponseWrap()
  @Header('Content-Type', XLSX_MIME)
  @ApiProduces(XLSX_MIME)
  @ApiOperation({ summary: 'Exportar el listado de expedientes a Excel, con los filtros y el alcance del actor' })
  async exportCasesExcel(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListDisciplinaryCasesQueryDto,
  ): Promise<StreamableFile> {
    const buffer = await this.exports.exportCasesExcel(actor, query);
    return file(buffer, XLSX_MIME, 'expedientes.xlsx');
  }

  @Get('cases/export/pdf')
  @Permissions(PERMISSIONS.DISCIPLINARY_EXPORT)
  @SkipResponseWrap()
  @Header('Content-Type', 'application/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Exportar el listado de expedientes a PDF, con los filtros y el alcance del actor' })
  async exportCasesPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListDisciplinaryCasesQueryDto,
  ): Promise<StreamableFile> {
    const buffer = await this.exports.exportCasesPdf(actor, query);
    return file(buffer, 'application/pdf', 'expedientes.pdf');
  }

  @Get('students/:studentId/history/export/excel')
  @Permissions(PERMISSIONS.DISCIPLINARY_EXPORT)
  @SkipResponseWrap()
  @Header('Content-Type', XLSX_MIME)
  @ApiProduces(XLSX_MIME)
  @ApiOperation({ summary: 'Exportar el historial disciplinario de un estudiante a Excel' })
  async exportHistoryExcel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query() query: StudentHistoryQueryDto,
  ): Promise<StreamableFile> {
    const buffer = await this.exports.exportHistoryExcel(actor, studentId, query);
    return file(buffer, XLSX_MIME, `historial-${studentId}.xlsx`);
  }

  @Get('students/:studentId/history/export/pdf')
  @Permissions(PERMISSIONS.DISCIPLINARY_EXPORT)
  @SkipResponseWrap()
  @Header('Content-Type', 'application/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Exportar el historial disciplinario de un estudiante a PDF' })
  async exportHistoryPdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query() query: StudentHistoryQueryDto,
  ): Promise<StreamableFile> {
    const buffer = await this.exports.exportHistoryPdf(actor, studentId, query);
    return file(buffer, 'application/pdf', `historial-${studentId}.pdf`);
  }

  @Get('cases/:id/export/pdf')
  @Permissions(PERMISSIONS.DISCIPLINARY_EXPORT)
  @SkipResponseWrap()
  @Header('Content-Type', 'application/pdf')
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Exportar un expediente a PDF, con hechos, cronología, resolución y recursos' })
  async exportCasePdf(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
    const buffer = await this.exports.exportCasePdf(actor, id);
    return file(buffer, 'application/pdf', `expediente-${id}.pdf`);
  }
}

function file(buffer: Buffer, type: string, name: string): StreamableFile {
  return new StreamableFile(buffer, {
    type,
    disposition: `attachment; filename="${name}"`,
  });
}
