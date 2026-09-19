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
import { formatUserFullName } from '../utils/attendance-labels.util';
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
  MANUAL: 'Manual',
  TOKEN: 'Token',
};

@Injectable()
export class AttendanceExportService {
  constructor(
    private readonly sessions: AttendanceSessionsService,
    private readonly records: AttendanceRecordsService,
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
      builder.drawTable(this.pdfColumns(), payload.roster.map((row) => this.toPdfRow(row)));
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

  private statusLabel(row: RosterStudentView): string {
    if (!row.attendance) return 'Sin marcar';
    return STATUS_LABEL[row.attendance.status] ?? row.attendance.status;
  }

  private methodLabel(row: RosterStudentView): string {
    if (!row.attendance) return '—';
    return METHOD_LABEL[row.attendance.registrationMethod] ?? row.attendance.registrationMethod;
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
}
