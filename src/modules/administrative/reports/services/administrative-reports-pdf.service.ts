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
  displayValue,
  formatDateOnly,
  formatDateTimeCostaRica,
  formatStatus,
  joinFilterLabels,
} from '../helpers/report-pdf.presentation';
import {
  AcademicPeriodReportItem,
  AcademicStructureReportItem,
  UserReportItem,
} from '../interfaces/administrative-report.interface';
import { AdministrativeReportsService } from './administrative-reports.service';

@Injectable()
export class AdministrativeReportsPdfService {
  constructor(private readonly reportsService: AdministrativeReportsService) {}

  async exportUsers(filters: UserReportFilterDto): Promise<Buffer> {
    const records = await this.reportsService.getUsersReport(filters);
    return this.buildPdf({
      title: 'Reporte de Usuarios',
      layout: 'landscape',
      recordCount: records.length,
      appliedFilters: this.formatUserFilters(filters),
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
      appliedFilters: this.formatAcademicStructureFilters(filters, records),
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
      appliedFilters: this.formatAcademicPeriodFilters(filters),
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
    appliedFilters: string;
    columns: PdfTableColumn[];
    rows: string[][];
  }): Promise<Buffer> {
    const builder = new ReportPdfBuilder(options.layout, options.title);
    builder.drawHeader({
      title: options.title,
      generatedAt: formatDateTimeCostaRica(new Date()),
      recordCount: options.recordCount,
      appliedFilters: options.appliedFilters,
    });

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
      displayValue(item.nationalId),
      displayValue(item.fullName),
      displayValue(item.email),
      displayValue(item.phone),
      item.roles.length > 0 ? item.roles.join(', ') : displayValue(null),
      formatStatus(item.status),
      formatDateTimeCostaRica(item.createdAt),
    ];
  }

  private toAcademicStructureRow(item: AcademicStructureReportItem): string[] {
    return [
      displayValue(item.groupName),
      displayValue(item.sectionName),
      String(item.gradeLevel),
      displayValue(item.specialty),
      String(item.studentCount),
      displayValue(item.academicPeriod),
      displayValue(item.guideTeacher),
      formatStatus(item.status),
    ];
  }

  private toAcademicPeriodRow(item: AcademicPeriodReportItem): string[] {
    return [
      displayValue(item.name),
      formatDateOnly(item.startDate),
      formatDateOnly(item.endDate),
      formatStatus(item.status),
      formatDateTimeCostaRica(item.createdAt),
    ];
  }

  private formatUserFilters(filters: UserReportFilterDto): string {
    const labels: string[] = [];

    if (filters.search !== undefined) {
      labels.push(`Búsqueda: ${filters.search}`);
    }

    if (filters.roleId !== undefined) {
      labels.push(`ID de rol: ${filters.roleId}`);
    }

    if (filters.status !== undefined) {
      labels.push(`Estado: ${formatStatus(filters.status)}`);
    }

    return joinFilterLabels(labels);
  }

  private formatAcademicStructureFilters(
    filters: AcademicStructureReportFilterDto,
    records: AcademicStructureReportItem[],
  ): string {
    const labels: string[] = [];

    if (filters.academicPeriodId !== undefined) {
      const periodName = records[0]?.academicPeriod?.trim();
      labels.push(
        periodName
          ? `Período académico: ${periodName}`
          : `ID de período: ${filters.academicPeriodId}`,
      );
    }

    if (filters.gradeLevel !== undefined) {
      labels.push(`Nivel: ${filters.gradeLevel}`);
    }

    if (filters.specialtyId !== undefined) {
      const specialtyName = records[0]?.specialty?.trim();
      labels.push(
        specialtyName
          ? `Especialidad: ${specialtyName}`
          : `ID de especialidad: ${filters.specialtyId}`,
      );
    }

    if (filters.status !== undefined) {
      labels.push(`Estado: ${formatStatus(filters.status)}`);
    }

    return joinFilterLabels(labels);
  }

  private formatAcademicPeriodFilters(
    filters: AcademicPeriodReportFilterDto,
  ): string {
    const labels: string[] = [];

    if (filters.status !== undefined) {
      labels.push(`Estado: ${formatStatus(filters.status)}`);
    }

    if (filters.startDate !== undefined) {
      labels.push(`Fecha de inicio: ${formatDateOnly(filters.startDate)}`);
    }

    if (filters.endDate !== undefined) {
      labels.push(`Fecha de fin: ${formatDateOnly(filters.endDate)}`);
    }

    return joinFilterLabels(labels);
  }
}
