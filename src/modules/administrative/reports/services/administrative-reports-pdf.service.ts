import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AcademicPeriodReportFilterDto } from '../dto/academic-period-report-filter.dto';
import { AcademicStructureReportFilterDto } from '../dto/academic-structure-report-filter.dto';
import { UserReportFilterDto } from '../dto/user-report-filter.dto';
import {
  PdfLayout,
  PdfTableColumn,
  ReportPdfBuilder,
} from '../helpers/report-pdf.builder';
import {
  AcademicPeriodReportItem,
  AcademicStructureReportItem,
  UserReportItem,
} from '../interfaces/administrative-report.interface';
import { AdministrativeReportsService } from './administrative-reports.service';

const EMPTY_VALUE = '—';

@Injectable()
export class AdministrativeReportsPdfService {
  constructor(private readonly reportsService: AdministrativeReportsService) {}

  async exportUsers(filters: UserReportFilterDto): Promise<Buffer> {
    const records = await this.reportsService.getUsersReport(filters);
    return this.buildPdf({
      title: 'Reporte de Usuarios',
      layout: 'landscape',
      recordCount: records.length,
      columns: [
        { header: 'Identificación', widthRatio: 0.12 },
        { header: 'Nombre completo', widthRatio: 0.18 },
        { header: 'Correo electrónico', widthRatio: 0.2 },
        { header: 'Teléfono', widthRatio: 0.11 },
        { header: 'Roles', widthRatio: 0.18 },
        { header: 'Estado', widthRatio: 0.09, align: 'center' },
        { header: 'Fecha de registro', widthRatio: 0.12 },
      ],
      rows: records.map((item) => this.toUserRow(item)),
    });
  }

  async exportAcademicStructure(
    filters: AcademicStructureReportFilterDto,
  ): Promise<Buffer> {
    const records =
      await this.reportsService.getAcademicStructureReport(filters);
    return this.buildPdf({
      title: 'Reporte de Estructura Académica',
      layout: 'landscape',
      recordCount: records.length,
      columns: [
        { header: 'Grupo', widthRatio: 0.1 },
        { header: 'Sección', widthRatio: 0.14 },
        { header: 'Nivel', widthRatio: 0.07, align: 'center' },
        { header: 'Especialidad', widthRatio: 0.14 },
        { header: 'Estudiantes', widthRatio: 0.1, align: 'center' },
        { header: 'Período académico', widthRatio: 0.13 },
        { header: 'Docente guía', widthRatio: 0.2 },
        { header: 'Estado', widthRatio: 0.12, align: 'center' },
      ],
      rows: records.map((item) => this.toAcademicStructureRow(item)),
    });
  }

  async exportAcademicPeriods(
    filters: AcademicPeriodReportFilterDto,
  ): Promise<Buffer> {
    const records = await this.reportsService.getAcademicPeriodsReport(filters);
    return this.buildPdf({
      title: 'Reporte de Períodos Académicos',
      layout: 'portrait',
      recordCount: records.length,
      columns: [
        { header: 'Nombre', widthRatio: 0.28 },
        { header: 'Fecha de inicio', widthRatio: 0.18 },
        { header: 'Fecha de finalización', widthRatio: 0.18 },
        { header: 'Estado', widthRatio: 0.16, align: 'center' },
        { header: 'Fecha de creación', widthRatio: 0.2 },
      ],
      rows: records.map((item) => this.toAcademicPeriodRow(item)),
    });
  }

  private async buildPdf(options: {
    title: string;
    layout: PdfLayout;
    recordCount: number;
    columns: PdfTableColumn[];
    rows: string[][];
  }): Promise<Buffer> {
    const builder = new ReportPdfBuilder(options.layout, options.title);
    builder.drawHeader(
      options.title,
      options.recordCount,
      this.formatGeneratedAt(new Date()),
    );

    if (options.rows.length === 0) {
      builder.drawEmptyState();
    } else {
      builder.drawTable(options.columns, options.rows);
    }

    try {
      return await builder.toBuffer();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new InternalServerErrorException(
        `No se pudo generar el PDF de ${options.title}: ${message}`,
      );
    }
  }

  private toUserRow(item: UserReportItem): string[] {
    return [
      item.nationalId,
      item.fullName,
      item.email,
      this.display(item.phone),
      item.roles.length > 0 ? item.roles.join(', ') : EMPTY_VALUE,
      item.status,
      this.formatDateTime(item.createdAt),
    ];
  }

  private toAcademicStructureRow(item: AcademicStructureReportItem): string[] {
    return [
      item.groupName,
      item.sectionName,
      String(item.gradeLevel),
      this.display(item.specialty),
      String(item.studentCount),
      item.academicPeriod,
      this.display(item.guideTeacher),
      item.status,
    ];
  }

  private toAcademicPeriodRow(item: AcademicPeriodReportItem): string[] {
    return [
      item.name,
      item.startDate,
      item.endDate,
      item.status,
      this.formatDateTime(item.createdAt),
    ];
  }

  private display(value: string | null): string {
    if (value === null || value.trim() === '') {
      return EMPTY_VALUE;
    }
    return value;
  }

  private formatDateTime(value: Date): string {
    const iso = value.toISOString();
    return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
  }

  private formatGeneratedAt(value: Date): string {
    return `${this.formatDateTime(value)} UTC`;
  }
}
