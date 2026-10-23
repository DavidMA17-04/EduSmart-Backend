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
import { getSeverityRule } from '../constants/infraction-severity.constant';
import { ListInfractionTypesQueryDto } from '../dto/infraction-type.dto';
import { InfractionTypesService, InfractionTypeView } from './infraction-types.service';

const TRACK_LABELS = {
  DIRECT: 'Amonestación directa',
  DUE_PROCESS: 'Debido proceso (Art. 150)',
} as const;

const TITLE = 'Catálogo de faltas disciplinarias (REAC 2026)';

@Injectable()
export class InfractionTypesExportService {
  constructor(private readonly infractionTypes: InfractionTypesService) {}

  async exportExcel(query: ListInfractionTypesQueryDto): Promise<Buffer> {
    const rows = await this.infractionTypes.findAll(query);
    try {
      return await buildExcelBuffer({
        sheetName: 'Catálogo de faltas',
        title: TITLE,
        generatedAt: formatDateTimeCostaRica(new Date()),
        recordCount: rows.length,
        appliedFilters: this.filterLine(query),
        columns: this.excelColumns(),
        rows: rows.map((row) => this.toCells(row)),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      throw new InternalServerErrorException(`No se pudo generar el Excel: ${message}`);
    }
  }

  async exportPdf(query: ListInfractionTypesQueryDto): Promise<Buffer> {
    const rows = await this.infractionTypes.findAll(query);
    const builder = new ReportPdfBuilder('landscape', TITLE);
    builder.drawHeader({
      title: TITLE,
      generatedAt: formatDateTimeCostaRica(new Date()),
      recordCount: rows.length,
      appliedFilters: this.filterLine(query),
    });
    if (rows.length === 0) {
      builder.drawEmptyState();
    } else {
      builder.drawTable(
        this.pdfColumns(),
        rows.map((row) => this.toCells(row).map(String)),
      );
    }
    return builder.toBuffer();
  }

  private toCells(row: InfractionTypeView): Array<string | number> {
    return [
      row.name,
      row.severityLabel,
      `−${row.deduction}`,
      TRACK_LABELS[row.track],
      row.legalReference ?? '—',
      row.isActive ? 'Activo' : 'Inactivo',
    ];
  }

  private excelColumns(): ExcelColumn[] {
    return [
      { header: 'Tipo de falta', width: 48, wrapText: true },
      { header: 'Gravedad', width: 14 },
      { header: 'Rebajo', width: 10, align: 'center' },
      { header: 'Vía', width: 26 },
      { header: 'Referencia', width: 24, wrapText: true },
      { header: 'Estado', width: 12, align: 'center' },
    ];
  }

  private pdfColumns(): PdfTableColumn[] {
    return [
      { header: 'Tipo de falta', widthRatio: 0.34 },
      { header: 'Gravedad', widthRatio: 0.11 },
      { header: 'Rebajo', widthRatio: 0.08, align: 'center' },
      { header: 'Vía', widthRatio: 0.19 },
      { header: 'Referencia', widthRatio: 0.18 },
      { header: 'Estado', widthRatio: 0.1, align: 'center' },
    ];
  }

  private filterLine(query: ListInfractionTypesQueryDto): string {
    const parts: string[] = [];
    parts.push(query.severity ? `Gravedad: ${getSeverityRule(query.severity).label}` : 'Gravedad: todas');
    parts.push(
      query.active === undefined ? 'Estado: todos' : query.active ? 'Estado: activos' : 'Estado: inactivos',
    );
    return parts.join(' | ');
  }
}
