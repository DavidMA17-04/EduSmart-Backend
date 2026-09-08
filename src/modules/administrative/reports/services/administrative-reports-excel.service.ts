import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AcademicPeriodReportFilterDto } from '../dto/academic-period-report-filter.dto';
import { AcademicStructureReportFilterDto } from '../dto/academic-structure-report-filter.dto';
import { UserReportFilterDto } from '../dto/user-report-filter.dto';
import {
  ExcelColumn,
  ExcelReportSpec,
  buildExcelBuffer,
} from '../helpers/report-excel.builder';
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
export class AdministrativeReportsExcelService {
  constructor(private readonly reportsService: AdministrativeReportsService) {}

  async exportUsers(filters: UserReportFilterDto): Promise<Buffer> {
    const records = await this.reportsService.getUsersReport(filters);
    return this.buildWorkbook({
      title: 'Reporte de Usuarios',
      sheetName: 'Usuarios',
      recordCount: records.length,
      appliedFilters: this.formatUserFilters(filters),
      columns: [
        { header: 'Identificación', width: 15 },
        { header: 'Nombre completo', width: 28, wrapText: true },
        { header: 'Correo electrónico', width: 34, wrapText: true },
        { header: 'Teléfono', width: 16 },
        { header: 'Roles', width: 22, wrapText: true },
        { header: 'Estado', width: 14, align: 'center' },
        { header: 'Fecha de registro', width: 22, align: 'center' },
      ],
      rows: records.map((item) => this.toUserRow(item)),
    });
  }

  async exportAcademicStructure(
    filters: AcademicStructureReportFilterDto,
  ): Promise<Buffer> {
    const records =
      await this.reportsService.getAcademicStructureReport(filters);
    return this.buildWorkbook({
      title: 'Reporte de Estructura Académica',
      sheetName: 'Estructura académica',
      recordCount: records.length,
      appliedFilters: this.formatAcademicStructureFilters(filters, records),
      columns: [
        { header: 'Grupo', width: 12, align: 'center' },
        { header: 'Sección', width: 18, wrapText: true },
        { header: 'Nivel', width: 10, align: 'center' },
        { header: 'Especialidad', width: 36, wrapText: true },
        { header: 'Cantidad de estudiantes', width: 22, align: 'center' },
        { header: 'Período académico', width: 20 },
        { header: 'Docente guía', width: 28, wrapText: true },
        { header: 'Estado', width: 14, align: 'center' },
      ],
      rows: records.map((item) => this.toAcademicStructureRow(item)),
    });
  }

  async exportAcademicPeriods(
    filters: AcademicPeriodReportFilterDto,
  ): Promise<Buffer> {
    const records = await this.reportsService.getAcademicPeriodsReport(filters);
    return this.buildWorkbook({
      title: 'Reporte de Períodos Académicos',
      sheetName: 'Períodos académicos',
      recordCount: records.length,
      appliedFilters: this.formatAcademicPeriodFilters(filters),
      columns: [
        { header: 'Nombre', width: 18, wrapText: true },
        { header: 'Fecha de inicio', width: 20, align: 'center' },
        { header: 'Fecha de finalización', width: 22, align: 'center' },
        { header: 'Estado', width: 14, align: 'center' },
        { header: 'Fecha de creación', width: 24, align: 'center' },
      ],
      rows: records.map((item) => this.toAcademicPeriodRow(item)),
    });
  }

  private async buildWorkbook(
    options: Omit<ExcelReportSpec, 'generatedAt'> & { generatedAt?: string },
  ): Promise<Buffer> {
    try {
      return await buildExcelBuffer({
        ...options,
        generatedAt: formatDateTimeCostaRica(new Date()),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new InternalServerErrorException(
        `No se pudo generar el Excel de ${options.title}: ${message}`,
      );
    }
  }

  private toUserRow(item: UserReportItem): Array<string | number> {
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

  private toAcademicStructureRow(
    item: AcademicStructureReportItem,
  ): Array<string | number> {
    return [
      displayValue(item.groupName),
      displayValue(item.sectionName),
      item.gradeLevel,
      displayValue(item.specialty),
      item.studentCount,
      displayValue(item.academicPeriod),
      displayValue(item.guideTeacher),
      formatStatus(item.status),
    ];
  }

  private toAcademicPeriodRow(
    item: AcademicPeriodReportItem,
  ): Array<string | number> {
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
