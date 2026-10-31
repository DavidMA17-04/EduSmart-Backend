import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  buildExcelBuffer,
  ExcelColumn,
} from '../../administrative/reports/helpers/report-excel.builder';
import {
  PdfTableColumn,
  ReportPdfBuilder,
} from '../../administrative/reports/helpers/report-pdf.builder';
import {
  EMPTY_VALUE,
  formatDateOnly,
  formatDateTimeCostaRica,
  joinFilterLabels,
} from '../../administrative/reports/helpers/report-pdf.presentation';
import { DepartureHistoryFilterDto } from '../dto/departure-history-filter.dto';
import { DepartureStatus, DepartureType } from '../entities/student-departure.entity';
import { DepartureHistoryItem } from '../interfaces/departures.interface';
import { DeparturesRepository } from '../repositories/departures.repository';

const REPORT_TITLE = 'Bitácora de salidas de estudiantes';

export const DEPARTURE_STATUS_LABEL: Record<DepartureStatus, string> = {
  [DepartureStatus.AUTHORIZED]: 'Autorizado',
  [DepartureStatus.REJECTED]: 'Denegado',
};

export const DEPARTURE_TYPE_LABEL: Record<DepartureType, string> = {
  [DepartureType.REGULAR]: 'Regular',
  [DepartureType.EARLY]: 'Anticipada',
  [DepartureType.EMERGENCY]: 'Emergencia',
};

function sectionLabel(item: DepartureHistoryItem): string {
  return item.student.groupName ?? item.student.sectionName ?? EMPTY_VALUE;
}

@Injectable()
export class StudentDeparturesExportService {
  constructor(private readonly repository: DeparturesRepository) {}

  private async load(filter: DepartureHistoryFilterDto) {
    if (filter.startDate && filter.endDate && filter.startDate > filter.endDate) {
      throw new BadRequestException('La fecha inicial no puede ser posterior a la final.');
    }
    const { items } = await this.repository.findHistory(filter, null);
    const authorized = items.filter((i) => i.status === DepartureStatus.AUTHORIZED).length;
    const rejected = items.length - authorized;
    const filters: string[] = [];
    if (filter.startDate) filters.push(`Desde ${formatDateOnly(filter.startDate)}`);
    if (filter.endDate) filters.push(`Hasta ${formatDateOnly(filter.endDate)}`);
    if (filter.status) filters.push(`Estado: ${DEPARTURE_STATUS_LABEL[filter.status]}`);
    if (filter.departureType) filters.push(`Tipo: ${DEPARTURE_TYPE_LABEL[filter.departureType]}`);
    if (filter.groupId) filters.push(`Sección: ${items[0]?.student.groupName ?? filter.groupId}`);
    if (filter.search) filters.push(`Búsqueda: "${filter.search}"`);
    const summary = `Autorizadas: ${authorized} · Denegadas: ${rejected}`;
    return { items, appliedFilters: `${joinFilterLabels(filters)}  |  Resumen: ${summary}` };
  }

  /** Quién se presentó a retirar. Un no vinculado nunca se muestra como encargado válido. */
  private presentedBy(item: DepartureHistoryItem): string {
    if (item.status === DepartureStatus.AUTHORIZED) return item.guardian?.fullName ?? EMPTY_VALUE;
    if (item.guardian && item.guardianLinked) return item.guardian.fullName;
    if (item.guardian) return `${item.guardian.fullName} (no vinculado)`;
    return item.guardianIdentifierMasked
      ? `Cédula ${item.guardianIdentifierMasked} (no vinculado)`
      : EMPTY_VALUE;
  }

  private row(item: DepartureHistoryItem): string[] {
    return [
      formatDateTimeCostaRica(new Date(item.departureTime)),
      item.student.fullName,
      item.student.nationalId,
      sectionLabel(item),
      this.presentedBy(item),
      item.relationship ?? EMPTY_VALUE,
      DEPARTURE_TYPE_LABEL[item.departureType],
      DEPARTURE_STATUS_LABEL[item.status],
      item.securityGuard.fullName,
      item.justificationReason ?? EMPTY_VALUE,
    ];
  }

  async excel(filter: DepartureHistoryFilterDto): Promise<Buffer> {
    const { items, appliedFilters } = await this.load(filter);
    const columns: ExcelColumn[] = [
      { header: 'Fecha y hora', width: 20 },
      { header: 'Estudiante', width: 30, wrapText: true },
      { header: 'Cédula', width: 14 },
      { header: 'Sección', width: 12, align: 'center' },
      { header: 'Retirado por', width: 30, wrapText: true },
      { header: 'Parentesco', width: 14 },
      { header: 'Tipo de salida', width: 14, align: 'center' },
      { header: 'Estado', width: 12, align: 'center' },
      { header: 'Guarda', width: 26, wrapText: true },
      { header: 'Motivo', width: 40, wrapText: true },
    ];
    return buildExcelBuffer({
      sheetName: 'Salidas',
      title: REPORT_TITLE,
      generatedAt: formatDateTimeCostaRica(new Date()),
      recordCount: items.length,
      appliedFilters,
      columns,
      rows: items.map((item) => this.row(item)),
    });
  }

  async pdf(filter: DepartureHistoryFilterDto): Promise<Buffer> {
    const { items, appliedFilters } = await this.load(filter);
    const columns: PdfTableColumn[] = [
      { header: 'Fecha y hora', widthRatio: 0.12 },
      { header: 'Estudiante', widthRatio: 0.13 },
      { header: 'Cédula', widthRatio: 0.08 },
      { header: 'Sección', widthRatio: 0.06, align: 'center' },
      { header: 'Retirado por', widthRatio: 0.13 },
      { header: 'Parentesco', widthRatio: 0.07 },
      { header: 'Tipo', widthRatio: 0.07, align: 'center' },
      { header: 'Estado', widthRatio: 0.07, align: 'center' },
      { header: 'Guarda', widthRatio: 0.11 },
      { header: 'Motivo', widthRatio: 0.16 },
    ];
    const builder = new ReportPdfBuilder('landscape', REPORT_TITLE);
    builder.drawHeader({
      title: REPORT_TITLE,
      generatedAt: formatDateTimeCostaRica(new Date()),
      recordCount: items.length,
      appliedFilters,
    });
    if (items.length === 0) builder.drawEmptyState();
    else
      builder.drawTable(
        columns,
        items.map((item) => this.row(item)),
      );
    try {
      return await builder.toBuffer();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      throw new InternalServerErrorException(`No se pudo generar el PDF: ${message}`);
    }
  }
}
