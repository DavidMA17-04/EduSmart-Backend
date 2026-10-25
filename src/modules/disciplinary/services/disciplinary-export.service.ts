import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  ExcelColumn,
  buildExcelBuffer,
} from '../../administrative/reports/helpers/report-excel.builder';
import {
  ReportPdfBuilder,
  type PdfTableColumn,
} from '../../administrative/reports/helpers/report-pdf.builder';
import { formatDateTimeCostaRica } from '../../administrative/reports/helpers/report-pdf.presentation';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { DisciplinaryCaseStatus } from '../constants/disciplinary.enums';
import { getSeverityRule, InfractionSeverity } from '../constants/infraction-severity.constant';
import { ListDisciplinaryAppealsQueryDto } from '../dto/list-disciplinary-appeals-query.dto';
import { ListDisciplinaryCasesQueryDto } from '../dto/list-disciplinary-cases-query.dto';
import { StudentHistoryQueryDto } from '../dto/student-history-query.dto';
import { appealDeadlineReportLabel, appealKindReportLabel, appealOutcomeReportLabel } from './appeal-reports';
import { deductionOf } from './conduct-grade';
import { DisciplinaryAppealListItem, DisciplinaryAppealQueryService } from './disciplinary-appeal-query.service';
import { DisciplinaryCasesService } from './disciplinary-cases.service';
import { statusLabel } from './disciplinary-workflow';

const LIST_TITLE = 'Listado de expedientes disciplinarios';
const PAGE_SIZE = 100;

const LIST_EXCEL: ExcelColumn[] = [
  { header: 'Número', width: 18 },
  { header: 'Estudiante', width: 32 },
  { header: 'Gravedad', width: 14 },
  { header: 'Estado', width: 24 },
  { header: 'Rebajo', width: 28 },
  { header: 'Fecha del hecho', width: 16 },
  { header: 'Vencimiento', width: 16 },
];

const LIST_PDF: PdfTableColumn[] = [
  { header: 'Número', widthRatio: 0.14 },
  { header: 'Estudiante', widthRatio: 0.22 },
  { header: 'Gravedad', widthRatio: 0.12 },
  { header: 'Estado', widthRatio: 0.16 },
  { header: 'Rebajo', widthRatio: 0.18 },
  { header: 'Fecha del hecho', widthRatio: 0.09 },
  { header: 'Vencimiento', widthRatio: 0.09 },
];

const HISTORY_EXCEL: ExcelColumn[] = [
  { header: 'Período', width: 18 },
  { header: 'Número', width: 18 },
  { header: 'Estado', width: 24 },
  { header: 'Gravedad', width: 14 },
  { header: 'Rebajo', width: 28 },
  { header: 'Nota de conducta', width: 18, align: 'center' },
];

const APPEALS_TITLE = 'Reporte de recursos disciplinarios';

const APPEALS_EXCEL: ExcelColumn[] = [
  { header: 'Expediente', width: 18 },
  { header: 'Recurso', width: 32 },
  { header: 'Estudiante', width: 32 },
  { header: 'Estado', width: 20 },
  { header: 'Resultado', width: 22 },
  { header: 'Presentado', width: 14 },
  { header: 'Resuelto', width: 14 },
  { header: 'Plazo', width: 14 },
];

const APPEALS_PDF: PdfTableColumn[] = [
  { header: 'Expediente', widthRatio: 0.14 },
  { header: 'Recurso', widthRatio: 0.18 },
  { header: 'Estudiante', widthRatio: 0.18 },
  { header: 'Estado', widthRatio: 0.12 },
  { header: 'Resultado', widthRatio: 0.12 },
  { header: 'Presentado', widthRatio: 0.09 },
  { header: 'Resuelto', widthRatio: 0.09 },
  { header: 'Plazo', widthRatio: 0.08 },
];

const HISTORY_PDF: PdfTableColumn[] = [
  { header: 'Período', widthRatio: 0.16 },
  { header: 'Número', widthRatio: 0.16 },
  { header: 'Estado', widthRatio: 0.18 },
  { header: 'Gravedad', widthRatio: 0.14 },
  { header: 'Rebajo', widthRatio: 0.22 },
  { header: 'Nota', widthRatio: 0.14, align: 'center' },
];

interface ListedCase {
  caseNumber: string;
  status: string;
  severity: string;
  severityLabel: string;
  studentFullName: string;
  occurredAt: string | null;
  dueOn: string | null;
}

interface HistoryExport {
  student: { fullName: string };
  periods: Array<{
    periodName: string;
    conductGrade: number;
    cases: Array<{ caseNumber: string; status: string; severityLabel: string; deductionLabel: string }>;
  }>;
}

interface CaseExport {
  caseNumber: string;
  status: string;
  severity: string;
  severityLabel: string;
  deduction: number;
  student: { fullName: string; nationalId: string };
  sectionName: string | null;
  gradeLevel: number | null;
  infractionType: { name: string };
  description: string;
  place: string;
  occurredAt: string | null;
  resolutionOutcome: string | null;
  resolutionReasoning: string | null;
  events: Array<{ type: string; actorName: string | null; createdAt: string | null; payload: Record<string, unknown> | null }>;
  appeals: Array<{ kind: string; isSubsidiary: boolean; outcome: string | null; body: string; reasoning: string | null }>;
}

@Injectable()
export class DisciplinaryExportService {
  constructor(
    private readonly cases: DisciplinaryCasesService,
    private readonly appeals: DisciplinaryAppealQueryService,
  ) {}

  async exportCasesExcel(actor: AuthenticatedUser, query: ListDisciplinaryCasesQueryDto): Promise<Buffer> {
    const rows = await this.allCases(actor, query);
    return this.excel(LIST_TITLE, 'Expedientes', this.filterLine(query), LIST_EXCEL, rows.map((row) => this.listCells(row)));
  }

  async exportCasesPdf(actor: AuthenticatedUser, query: ListDisciplinaryCasesQueryDto): Promise<Buffer> {
    const rows = await this.allCases(actor, query);
    return this.tablePdf('landscape', LIST_TITLE, this.filterLine(query), LIST_PDF, rows.map((row) => this.listCells(row).map(String)));
  }

  async exportHistoryExcel(actor: AuthenticatedUser, studentUserId: number, query: StudentHistoryQueryDto): Promise<Buffer> {
    const history = (await this.cases.history(actor, studentUserId, query)) as HistoryExport;
    const rows = this.historyRows(history);
    return this.excel(
      `Historial disciplinario · ${history.student.fullName}`,
      'Historial',
      history.student.fullName,
      HISTORY_EXCEL,
      rows,
    );
  }

  async exportHistoryPdf(actor: AuthenticatedUser, studentUserId: number, query: StudentHistoryQueryDto): Promise<Buffer> {
    const history = (await this.cases.history(actor, studentUserId, query)) as HistoryExport;
    const rows = this.historyRows(history).map((row) => row.map(String));
    return this.tablePdf(
      'landscape',
      `Historial disciplinario · ${history.student.fullName}`,
      history.student.fullName,
      HISTORY_PDF,
      rows,
    );
  }

  async exportAppealsExcel(actor: AuthenticatedUser, query: ListDisciplinaryAppealsQueryDto): Promise<Buffer> {
    const rows = await this.appeals.listAll(actor, query);
    return this.excel(APPEALS_TITLE, 'Recursos', this.appealFilterLine(query), APPEALS_EXCEL, rows.map((row) => this.appealCells(row)));
  }

  async exportAppealsPdf(actor: AuthenticatedUser, query: ListDisciplinaryAppealsQueryDto): Promise<Buffer> {
    const rows = await this.appeals.listAll(actor, query);
    return this.tablePdf('landscape', APPEALS_TITLE, this.appealFilterLine(query), APPEALS_PDF, rows.map((row) => this.appealCells(row).map(String)));
  }

  async exportCasePdf(actor: AuthenticatedUser, caseId: number): Promise<Buffer> {
    const detail = (await this.cases.findOne(actor, caseId)) as unknown as CaseExport;
    const deduction = deductionOf(detail.status as DisciplinaryCaseStatus, detail.severity as InfractionSeverity);
    const section = detail.gradeLevel != null && detail.sectionName ? `${detail.gradeLevel}-${detail.sectionName}` : (detail.sectionName ?? '—');
    const builder = new ReportPdfBuilder('portrait', `Expediente ${detail.caseNumber}`);
    builder.drawHeader({
      title: `Expediente ${detail.caseNumber}`,
      generatedAt: formatDateTimeCostaRica(new Date()),
      recordCount: 1,
      appliedFilters: detail.student.fullName,
    });
    builder.drawTable(
      [{ header: 'Dato', widthRatio: 0.32 }, { header: 'Valor', widthRatio: 0.68 }],
      [
        ['Estudiante', detail.student.fullName],
        ['Cédula', detail.student.nationalId || '—'],
        ['Sección', section],
        ['Falta', detail.infractionType.name],
        ['Gravedad', detail.severityLabel],
        ['Estado', statusLabel(detail.status as DisciplinaryCaseStatus)],
        ['Rebajo', deduction.label],
        ['Lugar', detail.place],
        ['Fecha del hecho', day(detail.occurredAt)],
        ['Hechos', detail.description],
      ],
    );
    builder.drawTable(
      [
        { header: 'Fecha', widthRatio: 0.18 },
        { header: 'Hecho', widthRatio: 0.28 },
        { header: 'Actor', widthRatio: 0.22 },
        { header: 'Detalle', widthRatio: 0.32 },
      ],
      detail.events.length
        ? detail.events.map((event) => [
            day(event.createdAt),
            eventLabel(event.type),
            event.actorName ?? 'Sistema',
            eventText(event.payload),
          ])
        : [['—', 'Sin cronología', '—', '—']],
    );
    builder.drawTable(
      [{ header: 'Resolución', widthRatio: 0.28 }, { header: 'Detalle', widthRatio: 0.72 }],
      [[
        detail.resolutionOutcome ?? 'Sin resolución',
        detail.resolutionReasoning ?? '—',
      ]],
    );
    builder.drawTable(
      [
        { header: 'Recurso', widthRatio: 0.24 },
        { header: 'Resultado', widthRatio: 0.2 },
        { header: 'Texto', widthRatio: 0.56 },
      ],
      detail.appeals?.length
        ? detail.appeals.map((appeal) => [
            `${appeal.kind === 'APPEAL' ? 'Apelación' : 'Revocatoria'}${appeal.isSubsidiary ? ' en subsidio' : ''}`,
            appeal.outcome ?? 'Pendiente',
            appeal.reasoning ?? appeal.body,
          ])
        : [['—', 'Sin recursos', '—']],
    );
    return builder.toBuffer();
  }

  private async allCases(actor: AuthenticatedUser, query: ListDisciplinaryCasesQueryDto): Promise<ListedCase[]> {
    const first = await this.cases.list(actor, { ...query, page: 1, pageSize: PAGE_SIZE });
    const rows = [...first.data];
    const pages = Math.ceil(first.total / first.pageSize);
    for (let page = 2; page <= pages; page += 1) {
      const next = await this.cases.list(actor, { ...query, page, pageSize: PAGE_SIZE });
      rows.push(...next.data);
    }
    return rows as ListedCase[];
  }

  private historyRows(history: HistoryExport): Array<Array<string | number>> {
    return history.periods.flatMap((period) =>
      period.cases.map((item) => [
        period.periodName,
        item.caseNumber,
        statusLabel(item.status as DisciplinaryCaseStatus),
        item.severityLabel,
        item.deductionLabel,
        period.conductGrade,
      ]),
    );
  }

  private listCells(row: ListedCase): Array<string | number> {
    const deduction = deductionOf(row.status as DisciplinaryCaseStatus, row.severity as InfractionSeverity);
    return [
      row.caseNumber,
      row.studentFullName,
      row.severityLabel || getSeverityRule(row.severity as InfractionSeverity).label,
      statusLabel(row.status as DisciplinaryCaseStatus),
      deduction.label,
      day(row.occurredAt),
      day(row.dueOn),
    ];
  }

  private appealCells(row: DisciplinaryAppealListItem): Array<string | number> {
    return [
      row.caseNumber,
      appealKindReportLabel(row.kind, row.isSubsidiary),
      row.studentFullName,
      statusLabel(row.caseStatus),
      appealOutcomeReportLabel(row.outcome),
      day(row.filedAt),
      day(row.resolvedAt),
      day(row.dueOn),
    ];
  }

  private appealFilterLine(query: ListDisciplinaryAppealsQueryDto): string {
    const parts = [
      query.kind ? `Recurso: ${appealKindReportLabel(query.kind)}` : 'Recurso: todos',
      query.outcome ? `Resultado: ${appealOutcomeReportLabel(query.outcome)}` : 'Resultado: todos',
      query.deadline ? `Plazo: ${appealDeadlineReportLabel(query.deadline)}` : 'Plazo: todos',
      query.studentUserId ? `Estudiante: ${query.studentUserId}` : 'Estudiante: todos',
      query.caseId ? `Expediente: ${query.caseId}` : 'Expediente: todos',
    ];
    return parts.join(' | ');
  }

  private filterLine(query: ListDisciplinaryCasesQueryDto): string {
    const parts = [
      query.groupId ? `Sección: ${query.groupId}` : 'Sección: todas',
      query.academicPeriodId ? `Período: ${query.academicPeriodId}` : 'Período: todos',
      query.status ? `Estado: ${statusLabel(query.status)}` : 'Estado: todos',
      query.severity ? `Gravedad: ${getSeverityRule(query.severity).label}` : 'Gravedad: todas',
    ];
    return parts.join(' | ');
  }

  private async excel(
    title: string,
    sheetName: string,
    filters: string,
    columns: ExcelColumn[],
    rows: Array<Array<string | number>>,
  ): Promise<Buffer> {
    try {
      return await buildExcelBuffer({
        sheetName,
        title,
        generatedAt: formatDateTimeCostaRica(new Date()),
        recordCount: rows.length,
        appliedFilters: filters,
        columns,
        rows,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      throw new InternalServerErrorException(`No se pudo generar el Excel: ${message}`);
    }
  }

  private async tablePdf(
    layout: 'portrait' | 'landscape',
    title: string,
    filters: string,
    columns: PdfTableColumn[],
    rows: string[][],
  ): Promise<Buffer> {
    const builder = new ReportPdfBuilder(layout, title);
    builder.drawHeader({
      title,
      generatedAt: formatDateTimeCostaRica(new Date()),
      recordCount: rows.length,
      appliedFilters: filters,
    });
    if (rows.length === 0) builder.drawEmptyState();
    else builder.drawTable(columns, rows);
    return builder.toBuffer();
  }
}

function day(value: string | null): string {
  if (!value) return '—';
  return value.slice(0, 10);
}

function eventText(payload: Record<string, unknown> | null): string {
  const note = payload?.message ?? payload?.note;
  return typeof note === 'string' && note.trim() ? note : '—';
}

function eventLabel(type: string): string {
  const labels: Record<string, string> = {
    CASE_OPENED: 'Apertura',
    STATUS_CHANGE: 'Cambio de estado',
    DEFENSE_FILED: 'Descargo',
    REVOCATION_FILED: 'Revocatoria',
    APPEAL_FILED: 'Apelación',
    REVOCATION_RESOLVED: 'Revocatoria resuelta',
    PRECAUTIONARY_ORDERED: 'Retiro precautorio',
    PHYSICAL_DELIVERY: 'Entrega física',
    OBSERVATION: 'Observación',
    INFO_REQUEST: 'Solicitud de información',
    INFO_RESPONSE: 'Respuesta del docente',
    COUNSEL_REQUEST: 'Solicitud de criterio',
    COUNSEL_OPINION: 'Criterio de Orientación',
    FOLLOW_UP: 'Seguimiento',
    FOLLOW_UP_OUTCOME: 'Resultado del compromiso',
    FOLLOW_UP_REMINDER: 'Recordatorio de revisión',
    SUBSIDIARY_ELEVATED: 'Apelación elevada',
  };
  return labels[type] ?? type;
}
