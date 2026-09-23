import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  ExcelColumn,
  buildExcelBuffer,
} from '../../administrative/reports/helpers/report-excel.builder';
import {
  ReportPdfBuilder,
  type PdfTableColumn,
} from '../../administrative/reports/helpers/report-pdf.builder';
import {
  formatDateOnly,
  formatDateTimeCostaRica,
  joinFilterLabels,
} from '../../administrative/reports/helpers/report-pdf.presentation';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AttendanceAnalyticsFilterDto } from '../dto/attendance-analytics-filter.dto';
import {
  AttendanceAnalyticsService,
  type AttendanceAnalyticsSummaryView,
  type AttendanceStudentReportRow,
} from './attendance-analytics.service';

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  [AttendanceStatus.PRESENT]: 'Presente',
  [AttendanceStatus.ABSENT]: 'Ausente',
  [AttendanceStatus.LATE]: 'Tardía',
  [AttendanceStatus.JUSTIFIED]: 'Justificada',
};

@Injectable()
export class AttendanceRangeExportService {
  constructor(private readonly analytics: AttendanceAnalyticsService) {}

  async exportExcel(
    filters: AttendanceAnalyticsFilterDto,
    actor: AuthenticatedUser,
  ): Promise<Buffer> {
    const payload = await this.buildPayload(filters, actor);
    try {
      return await buildExcelBuffer({
        title: 'Reporte de asistencia',
        sheetName: 'Asistencia',
        generatedAt: formatDateTimeCostaRica(new Date()),
        recordCount: payload.rows.length,
        appliedFilters: payload.metaLine,
        columns: this.columns(),
        rows: payload.rows.map((row) => this.toExcelRow(row)),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      throw new InternalServerErrorException(
        `No se pudo generar el Excel de asistencia: ${message}`,
      );
    }
  }

  async exportPdf(
    filters: AttendanceAnalyticsFilterDto,
    actor: AuthenticatedUser,
  ): Promise<Buffer> {
    const payload = await this.buildPayload(filters, actor);
    const builder = new ReportPdfBuilder('landscape', 'Reporte de asistencia');
    builder.drawHeader({
      title: 'Reporte institucional de asistencia',
      generatedAt: formatDateTimeCostaRica(new Date()),
      recordCount: payload.rows.length,
      appliedFilters: `${payload.metaLine} | ${payload.summaryLine}`,
    });

    if (payload.rows.length === 0) {
      builder.drawEmptyState();
    } else {
      builder.drawTable(
        this.pdfColumns(),
        payload.rows.map((row) => this.toPdfRow(row)),
      );
    }

    try {
      return await builder.toBuffer();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      throw new InternalServerErrorException(
        `No se pudo generar el PDF de asistencia: ${message}`,
      );
    }
  }

  private async buildPayload(
    filters: AttendanceAnalyticsFilterDto,
    actor: AuthenticatedUser,
  ): Promise<{
    rows: AttendanceStudentReportRow[];
    summary: AttendanceAnalyticsSummaryView;
    metaLine: string;
    summaryLine: string;
  }> {
    const [rows, summary] = await Promise.all([
      this.analytics.getStudentReportRows(filters, actor),
      this.analytics.getSummary(filters, actor),
    ]);

    const metaLine = joinFilterLabels([
      summary.scope === 'institutional'
        ? 'Alcance: institucional'
        : 'Alcance: asignaciones del docente',
      summary.startDate ? `Desde: ${formatDateOnly(summary.startDate)}` : '',
      summary.endDate ? `Hasta: ${formatDateOnly(summary.endDate)}` : '',
      filters.groupId != null ? `Grupo: ${filters.groupId}` : '',
      filters.courseId != null ? `Asignatura: ${filters.courseId}` : '',
      filters.status ? `Estado: ${STATUS_LABEL[filters.status]}` : '',
    ].filter(Boolean));

    const summaryLine = [
      `Clases: ${summary.totalSessions}`,
      `Presentismo: ${summary.averageAttendanceRate.toFixed(2)}%`,
      `Justificaciones: ${summary.totalJustifications}`,
      `Presentes: ${summary.counts.present}`,
      `Ausentes: ${summary.counts.absent}`,
      `Tardías: ${summary.counts.late}`,
      `Justificadas: ${summary.counts.justified}`,
    ].join(' · ');

    return { rows, summary, metaLine, summaryLine };
  }

  private columns(): ExcelColumn[] {
    return [
      { header: 'Cédula / ID', width: 16 },
      { header: 'Estudiante', width: 28, wrapText: true },
      { header: 'Grupo', width: 12 },
      { header: 'Asignatura', width: 22, wrapText: true },
      { header: 'Docente', width: 22, wrapText: true },
      { header: 'Presentes', width: 12, align: 'center' },
      { header: 'Ausentes', width: 12, align: 'center' },
      { header: 'Tardías', width: 12, align: 'center' },
      { header: 'Justificadas', width: 14, align: 'center' },
      { header: 'Total', width: 10, align: 'center' },
      { header: '% Presentismo', width: 14, align: 'center' },
    ];
  }

  private pdfColumns(): PdfTableColumn[] {
    return [
      { header: 'ID', widthRatio: 0.1 },
      { header: 'Estudiante', widthRatio: 0.16 },
      { header: 'Grupo', widthRatio: 0.08 },
      { header: 'Asignatura', widthRatio: 0.14 },
      { header: 'P', widthRatio: 0.06, align: 'center' },
      { header: 'A', widthRatio: 0.06, align: 'center' },
      { header: 'T', widthRatio: 0.06, align: 'center' },
      { header: 'J', widthRatio: 0.06, align: 'center' },
      { header: 'Total', widthRatio: 0.08, align: 'center' },
      { header: '%', widthRatio: 0.08, align: 'center' },
    ];
  }

  private toExcelRow(row: AttendanceStudentReportRow): Array<string | number> {
    return [
      row.nationalId,
      row.fullName,
      row.groupName,
      row.courseName,
      row.teacherName,
      row.present,
      row.absent,
      row.late,
      row.justified,
      row.total,
      row.attendanceRate,
    ];
  }

  private toPdfRow(row: AttendanceStudentReportRow): string[] {
    return [
      row.nationalId,
      row.fullName,
      row.groupName,
      row.courseName,
      String(row.present),
      String(row.absent),
      String(row.late),
      String(row.justified),
      String(row.total),
      `${row.attendanceRate.toFixed(1)}%`,
    ];
  }
}
