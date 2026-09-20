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
  displayValue,
  formatDateOnly,
  formatDateTimeCostaRica,
} from '../../administrative/reports/helpers/report-pdf.presentation';
import { AttendanceStatus } from '../../../common/enums/attendance-status.enum';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AttendanceHistoryFilterDto } from '../dto/attendance-history-filter.dto';
import { formatUserFullName } from '../utils/attendance-labels.util';
import {
  AttendanceHistoryItemView,
  AttendanceHistoryService,
} from './attendance-history.service';
import {
  AttendanceRecordsService,
  type RosterStudentView,
} from './attendance-records.service';
import { AttendanceSessionsService } from './attendance-sessions.service';

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  LATE: 'Tardía',
  JUSTIFIED: 'Justificada',
};

const METHOD_LABEL: Record<string, string> = {
  MANUAL: 'Manual (Docente)',
  TOKEN: 'Token (Automático)',
};

@Injectable()
export class AttendanceExportService {
  constructor(
    private readonly sessions: AttendanceSessionsService,
    private readonly records: AttendanceRecordsService,
    private readonly history: AttendanceHistoryService,
  ) {}

  async exportExcel(
    sessionId: number,
    actor: AuthenticatedUser,
  ): Promise<Buffer> {
    const payload = await this.buildPayload(sessionId, actor);
    try {
      return await buildExcelBuffer({
        title: 'Reporte de Asistencia',
        sheetName: 'Asistencia',
        generatedAt: formatDateTimeCostaRica(new Date()),
        recordCount: payload.roster.length,
        appliedFilters: payload.metaLine,
        columns: this.columns(),
        rows: payload.roster.map((row) => this.toExcelRow(row)),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new InternalServerErrorException(
        `No se pudo generar el Excel de asistencia: ${message}`,
      );
    }
  }

  async exportPdf(
    sessionId: number,
    actor: AuthenticatedUser,
  ): Promise<Buffer> {
    const payload = await this.buildPayload(sessionId, actor);
    const builder = new ReportPdfBuilder('landscape', 'Reporte de Asistencia');
    builder.drawHeader({
      title: 'Reporte de Asistencia',
      generatedAt: formatDateTimeCostaRica(new Date()),
      recordCount: payload.roster.length,
      appliedFilters: `${payload.metaLine} | ${payload.summaryLine}`,
    });

    if (payload.roster.length === 0) {
      builder.drawEmptyState();
    } else {
      builder.drawTable(
        this.pdfColumns(),
        payload.roster.map((row) => this.toPdfRow(row)),
      );
    }

    try {
      return await builder.toBuffer();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new InternalServerErrorException(
        `No se pudo generar el PDF de asistencia: ${message}`,
      );
    }
  }

  async exportHistoryExcel(
    filters: AttendanceHistoryFilterDto,
    actor: AuthenticatedUser,
  ): Promise<Buffer> {
    const items = await this.history.listForExport(filters, actor);
    const summary = await this.history.summarize(filters, actor);
    try {
      return await buildExcelBuffer({
        title: 'Historial de Asistencia',
        sheetName: 'Historial',
        generatedAt: formatDateTimeCostaRica(new Date()),
        recordCount: items.length,
        appliedFilters: this.historyFilterLine(filters, summary),
        columns: this.historyColumns(),
        rows: items.map((row) => this.toHistoryExcelRow(row)),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new InternalServerErrorException(
        `No se pudo generar el Excel del historial: ${message}`,
      );
    }
  }

  async exportHistoryPdf(
    filters: AttendanceHistoryFilterDto,
    actor: AuthenticatedUser,
  ): Promise<Buffer> {
    const items = await this.history.listForExport(filters, actor);
    const summary = await this.history.summarize(filters, actor);
    const builder = new ReportPdfBuilder('landscape', 'Historial de Asistencia');
    builder.drawHeader({
      title: 'Historial de Asistencia',
      generatedAt: formatDateTimeCostaRica(new Date()),
      recordCount: items.length,
      appliedFilters: this.historyFilterLine(filters, summary),
    });

    if (items.length === 0) {
      builder.drawEmptyState();
    } else {
      builder.drawTable(
        this.historyPdfColumns(),
        items.map((row) => this.toHistoryPdfRow(row)),
      );
    }

    try {
      return await builder.toBuffer();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new InternalServerErrorException(
        `No se pudo generar el PDF del historial: ${message}`,
      );
    }
  }

  private historyFilterLine(
    filters: AttendanceHistoryFilterDto,
    summary: {
      total: number;
      present: number;
      late: number;
      absent: number;
      justified: number;
      attendancePercent: number;
      band: string;
    },
  ): string {
    const parts = [
      filters.startDate ? `Desde: ${filters.startDate}` : null,
      filters.endDate ? `Hasta: ${filters.endDate}` : null,
      filters.groupId != null ? `Grupo ID: ${filters.groupId}` : null,
      filters.teachingAssignmentId != null
        ? `Asignación ID: ${filters.teachingAssignmentId}`
        : null,
      filters.registrationMethod
        ? `Método: ${METHOD_LABEL[filters.registrationMethod] ?? filters.registrationMethod}`
        : null,
      filters.status
        ? `Estado: ${STATUS_LABEL[filters.status] ?? filters.status}`
        : null,
      `Resumen: ${summary.attendancePercent}% (${summary.band}) · P${summary.present} T${summary.late} A${summary.absent} J${summary.justified}`,
    ].filter(Boolean);
    return parts.join(' | ');
  }

  private async buildPayload(sessionId: number, actor: AuthenticatedUser) {
    const detail = await this.sessions.getSessionDetail(sessionId, actor);
    const session = await this.sessions.findOne(sessionId);
    const roster = await this.records.getRoster(sessionId, actor);

    const teacher = session.teachingAssignment?.user
      ? formatUserFullName(session.teachingAssignment.user)
      : '—';

    const present = roster.filter(
      (r) => r.attendance?.status === AttendanceStatus.PRESENT,
    ).length;
    const absent = roster.filter(
      (r) => r.attendance?.status === AttendanceStatus.ABSENT,
    ).length;
    const late = roster.filter(
      (r) => r.attendance?.status === AttendanceStatus.LATE,
    ).length;
    const justified = roster.filter(
      (r) => r.attendance?.status === AttendanceStatus.JUSTIFIED,
    ).length;
    const unmarked = roster.filter((r) => r.attendance == null).length;

    const metaLine = [
      `Asignatura: ${detail.offering.name}`,
      `Grupo: ${detail.group.name}`,
      `Docente: ${teacher}`,
      `Fecha: ${formatDateOnly(detail.sessionDate)}`,
      `Estado sesión: ${detail.status === 'OPEN' ? 'En curso' : 'Cerrada'}`,
    ].join(' | ');

    const summaryLine = [
      `Total: ${roster.length}`,
      `Presentes: ${present}`,
      `Ausentes: ${absent}`,
      `Tardías: ${late}`,
      `Justificadas: ${justified}`,
      `Sin marcar: ${unmarked}`,
    ].join(' · ');

    return { detail, roster, metaLine, summaryLine };
  }

  private columns(): ExcelColumn[] {
    return [
      { header: 'Cédula / ID', width: 16 },
      { header: 'Nombre completo', width: 32, wrapText: true },
      { header: 'Estado', width: 14, align: 'center' },
      { header: 'Método', width: 12, align: 'center' },
      { header: 'Observaciones', width: 24, wrapText: true },
    ];
  }

  private pdfColumns(): PdfTableColumn[] {
    return [
      { header: 'Cédula / ID', widthRatio: 0.16 },
      { header: 'Nombre completo', widthRatio: 0.34 },
      { header: 'Estado', widthRatio: 0.16, align: 'center' },
      { header: 'Método', widthRatio: 0.14, align: 'center' },
      { header: 'Observaciones', widthRatio: 0.2 },
    ];
  }

  private historyColumns(): ExcelColumn[] {
    return [
      { header: 'Fecha', width: 12 },
      { header: 'Curso / Materia', width: 22, wrapText: true },
      { header: 'Lección', width: 10, align: 'center' },
      { header: 'Horario', width: 14, align: 'center' },
      { header: 'Tipo de registro', width: 18 },
      { header: 'Estado', width: 14, align: 'center' },
      { header: 'Registrado por', width: 24, wrapText: true },
      { header: 'Grupo', width: 10 },
      { header: 'Estudiante', width: 28, wrapText: true },
    ];
  }

  private historyPdfColumns(): PdfTableColumn[] {
    return [
      { header: 'Fecha', widthRatio: 0.1 },
      { header: 'Curso', widthRatio: 0.16 },
      { header: 'Lección', widthRatio: 0.08, align: 'center' },
      { header: 'Horario', widthRatio: 0.12, align: 'center' },
      { header: 'Tipo', widthRatio: 0.14 },
      { header: 'Estado', widthRatio: 0.1, align: 'center' },
      { header: 'Registrado por', widthRatio: 0.16 },
      { header: 'Estudiante', widthRatio: 0.14 },
    ];
  }

  private statusLabel(row: RosterStudentView): string {
    if (!row.attendance) return 'Sin marcar';
    return STATUS_LABEL[row.attendance.status] ?? row.attendance.status;
  }

  private methodLabel(row: RosterStudentView): string {
    if (!row.attendance) return '—';
    return (
      METHOD_LABEL[row.attendance.registrationMethod] ??
      row.attendance.registrationMethod
    );
  }

  private historyStatusLabel(row: AttendanceHistoryItemView): string {
    if (row.status === AttendanceStatus.LATE && row.lateMinutes != null) {
      return `Tarde ${row.lateMinutes} min.`;
    }
    return STATUS_LABEL[row.status] ?? row.status;
  }

  private lessonLabel(row: AttendanceHistoryItemView): string {
    if (row.lessonNumber == null) return '—';
    if (row.lessonTotal != null) return `${row.lessonNumber}/${row.lessonTotal}`;
    return String(row.lessonNumber);
  }

  private scheduleLabel(row: AttendanceHistoryItemView): string {
    if (!row.scheduleStartTime || !row.scheduleEndTime) return '—';
    return `${row.scheduleStartTime} - ${row.scheduleEndTime}`;
  }

  private toExcelRow(row: RosterStudentView): Array<string | number> {
    return [
      displayValue(row.nationalId),
      displayValue(row.fullName),
      this.statusLabel(row),
      this.methodLabel(row),
      '—',
    ];
  }

  private toPdfRow(row: RosterStudentView): string[] {
    return [
      displayValue(row.nationalId),
      displayValue(row.fullName),
      this.statusLabel(row),
      this.methodLabel(row),
      '—',
    ];
  }

  private toHistoryExcelRow(
    row: AttendanceHistoryItemView,
  ): Array<string | number> {
    return [
      displayValue(row.sessionDate),
      displayValue(row.offering.name),
      this.lessonLabel(row),
      this.scheduleLabel(row),
      METHOD_LABEL[row.registrationMethod] ?? row.registrationMethod,
      this.historyStatusLabel(row),
      displayValue(row.registeredBy.fullName),
      displayValue(row.group.name),
      displayValue(row.student.fullName),
    ];
  }

  private toHistoryPdfRow(row: AttendanceHistoryItemView): string[] {
    return [
      displayValue(row.sessionDate),
      displayValue(row.offering.name),
      this.lessonLabel(row),
      this.scheduleLabel(row),
      METHOD_LABEL[row.registrationMethod] ?? row.registrationMethod,
      this.historyStatusLabel(row),
      displayValue(row.registeredBy.fullName),
      displayValue(row.student.fullName),
    ];
  }
}
