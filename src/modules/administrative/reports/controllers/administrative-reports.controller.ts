import { Controller, Get, Header, Query, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { SkipResponseWrap } from '../../../../common/decorators/skip-response-wrap.decorator';
import { AcademicPeriodReportFilterDto } from '../dto/academic-period-report-filter.dto';
import { AcademicStructureReportFilterDto } from '../dto/academic-structure-report-filter.dto';
import { UserReportFilterDto } from '../dto/user-report-filter.dto';
import {
  AcademicPeriodReportItem,
  AcademicStructureReportItem,
  UserReportItem,
} from '../interfaces/administrative-report.interface';
import { AdministrativeReportsExcelService } from '../services/administrative-reports-excel.service';
import { AdministrativeReportsPdfService } from '../services/administrative-reports-pdf.service';
import { AdministrativeReportsService } from '../services/administrative-reports.service';

@ApiTags('Administrative - Reports')
@ApiBearerAuth()
@Controller('administrative-reports')
export class AdministrativeReportsController {
  constructor(
    private readonly service: AdministrativeReportsService,
    private readonly pdfService: AdministrativeReportsPdfService,
    private readonly excelService: AdministrativeReportsExcelService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Reporte de usuarios administrativos' })
  getUsersReport(
    @Query() filters: UserReportFilterDto,
  ): Promise<UserReportItem[]> {
    return this.service.getUsersReport(filters);
  }

  @Get('users/pdf')
  @SkipResponseWrap()
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="reporte-usuarios.pdf"')
  @ApiOperation({ summary: 'Exportar reporte de usuarios en PDF' })
  @ApiProduces('application/pdf')
  async exportUsersPdf(
    @Query() filters: UserReportFilterDto,
  ): Promise<StreamableFile> {
    const buffer = await this.pdfService.exportUsers(filters);
    return this.toPdfFile(buffer, 'reporte-usuarios.pdf');
  }

  @Get('users/excel')
  @SkipResponseWrap()
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    'attachment; filename="reporte-usuarios.xlsx"',
  )
  @ApiOperation({ summary: 'Exportar reporte de usuarios en Excel' })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async exportUsersExcel(
    @Query() filters: UserReportFilterDto,
  ): Promise<StreamableFile> {
    const buffer = await this.excelService.exportUsers(filters);
    return this.toExcelFile(buffer, 'reporte-usuarios.xlsx');
  }

  @Get('academic-structure')
  @ApiOperation({ summary: 'Reporte de estructura académica (grupos y secciones)' })
  getAcademicStructureReport(
    @Query() filters: AcademicStructureReportFilterDto,
  ): Promise<AcademicStructureReportItem[]> {
    return this.service.getAcademicStructureReport(filters);
  }

  @Get('academic-structure/pdf')
  @SkipResponseWrap()
  @Header('Content-Type', 'application/pdf')
  @Header(
    'Content-Disposition',
    'attachment; filename="reporte-estructura-academica.pdf"',
  )
  @ApiOperation({ summary: 'Exportar reporte de estructura académica en PDF' })
  @ApiProduces('application/pdf')
  async exportAcademicStructurePdf(
    @Query() filters: AcademicStructureReportFilterDto,
  ): Promise<StreamableFile> {
    const buffer = await this.pdfService.exportAcademicStructure(filters);
    return this.toPdfFile(buffer, 'reporte-estructura-academica.pdf');
  }

  @Get('academic-structure/excel')
  @SkipResponseWrap()
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    'attachment; filename="reporte-estructura-academica.xlsx"',
  )
  @ApiOperation({ summary: 'Exportar reporte de estructura académica en Excel' })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async exportAcademicStructureExcel(
    @Query() filters: AcademicStructureReportFilterDto,
  ): Promise<StreamableFile> {
    const buffer = await this.excelService.exportAcademicStructure(filters);
    return this.toExcelFile(buffer, 'reporte-estructura-academica.xlsx');
  }

  @Get('academic-periods')
  @ApiOperation({ summary: 'Reporte de períodos académicos' })
  getAcademicPeriodsReport(
    @Query() filters: AcademicPeriodReportFilterDto,
  ): Promise<AcademicPeriodReportItem[]> {
    return this.service.getAcademicPeriodsReport(filters);
  }

  @Get('academic-periods/pdf')
  @SkipResponseWrap()
  @Header('Content-Type', 'application/pdf')
  @Header(
    'Content-Disposition',
    'attachment; filename="reporte-periodos-academicos.pdf"',
  )
  @ApiOperation({ summary: 'Exportar reporte de períodos académicos en PDF' })
  @ApiProduces('application/pdf')
  async exportAcademicPeriodsPdf(
    @Query() filters: AcademicPeriodReportFilterDto,
  ): Promise<StreamableFile> {
    const buffer = await this.pdfService.exportAcademicPeriods(filters);
    return this.toPdfFile(buffer, 'reporte-periodos-academicos.pdf');
  }

  @Get('academic-periods/excel')
  @SkipResponseWrap()
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @Header(
    'Content-Disposition',
    'attachment; filename="reporte-periodos-academicos.xlsx"',
  )
  @ApiOperation({ summary: 'Exportar reporte de períodos académicos en Excel' })
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async exportAcademicPeriodsExcel(
    @Query() filters: AcademicPeriodReportFilterDto,
  ): Promise<StreamableFile> {
    const buffer = await this.excelService.exportAcademicPeriods(filters);
    return this.toExcelFile(buffer, 'reporte-periodos-academicos.xlsx');
  }

  private toPdfFile(buffer: Buffer, filename: string): StreamableFile {
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
      length: buffer.length,
    });
  }

  private toExcelFile(buffer: Buffer, filename: string): StreamableFile {
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${filename}"`,
      length: buffer.length,
    });
  }
}
