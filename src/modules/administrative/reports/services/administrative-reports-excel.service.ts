import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AcademicPeriodReportFilterDto } from '../dto/academic-period-report-filter.dto';
import { AcademicStructureReportFilterDto } from '../dto/academic-structure-report-filter.dto';
import { UserReportFilterDto } from '../dto/user-report-filter.dto';
import {
  ExcelColumn,
  buildExcelBuffer,
} from '../helpers/report-excel.builder';
import {
  AcademicPeriodReportItem,
  AcademicStructureReportItem,
  UserReportItem,
} from '../interfaces/administrative-report.interface';
import { AdministrativeReportsService } from './administrative-reports.service';

const EMPTY_VALUE = '—';

@Injectable()
export class AdministrativeReportsExcelService {
  constructor(private readonly reportsService: AdministrativeReportsService) {}

  async exportUsers(filters: UserReportFilterDto): Promise<Buffer> {
    const records = await this.reportsService.getUsersReport(filters);
    return this.buildWorkbook({
      title: 'Usuarios',
      sheetName: 'Usuarios',
      columns: [
        { header: 'Identificación', width: 16 },
        { header: 'Nombre completo', width: 28 },
        { header: 'Correo electrónico', width: 32 },
        { header: 'Teléfono', width: 16 },
        { header: 'Roles', width: 28 },
        { header: 'Estado', width: 14 },
        { header: 'Fecha de registro', width: 20 },
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
      title: 'Estructura Académica',
      sheetName: 'Estructura Académica',
      columns: [
        { header: 'Grupo', width: 14 },
        { header: 'Sección', width: 22 },
        { header: 'Nivel', width: 10 },
        { header: 'Especialidad', width: 22 },
        { header: 'Cantidad de estudiantes', width: 24 },
        { header: 'Período académico', width: 22 },
        { header: 'Docente guía', width: 28 },
        { header: 'Estado', width: 14 },
      ],
      rows: records.map((item) => this.toAcademicStructureRow(item)),
    });
  }

  async exportAcademicPeriods(
    filters: AcademicPeriodReportFilterDto,
  ): Promise<Buffer> {
    const records = await this.reportsService.getAcademicPeriodsReport(filters);
    return this.buildWorkbook({
      title: 'Períodos Académicos',
      sheetName: 'Períodos Académicos',
      columns: [
        { header: 'Nombre', width: 28 },
        { header: 'Fecha de inicio', width: 18 },
        { header: 'Fecha de finalización', width: 22 },
        { header: 'Estado', width: 14 },
        { header: 'Fecha de creación', width: 20 },
      ],
      rows: records.map((item) => this.toAcademicPeriodRow(item)),
    });
  }

  private buildWorkbook(options: {
    title: string;
    sheetName: string;
    columns: ExcelColumn[];
    rows: Array<Record<string, string | number>>;
  }): Buffer {
    try {
      return buildExcelBuffer({
        sheetName: options.sheetName,
        columns: options.columns,
        rows: options.rows,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new InternalServerErrorException(
        `No se pudo generar el Excel de ${options.title}: ${message}`,
      );
    }
  }

  private toUserRow(item: UserReportItem): Record<string, string | number> {
    return {
      Identificación: item.nationalId,
      'Nombre completo': item.fullName,
      'Correo electrónico': item.email,
      Teléfono: this.display(item.phone),
      Roles: item.roles.length > 0 ? item.roles.join(', ') : EMPTY_VALUE,
      Estado: item.status,
      'Fecha de registro': this.formatDateTime(item.createdAt),
    };
  }

  private toAcademicStructureRow(
    item: AcademicStructureReportItem,
  ): Record<string, string | number> {
    return {
      Grupo: item.groupName,
      Sección: item.sectionName,
      Nivel: item.gradeLevel,
      Especialidad: this.display(item.specialty),
      'Cantidad de estudiantes': item.studentCount,
      'Período académico': item.academicPeriod,
      'Docente guía': this.display(item.guideTeacher),
      Estado: item.status,
    };
  }

  private toAcademicPeriodRow(
    item: AcademicPeriodReportItem,
  ): Record<string, string | number> {
    return {
      Nombre: item.name,
      'Fecha de inicio': item.startDate,
      'Fecha de finalización': item.endDate,
      Estado: item.status,
      'Fecha de creación': this.formatDateTime(item.createdAt),
    };
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
}
