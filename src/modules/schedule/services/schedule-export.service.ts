import { Injectable } from '@nestjs/common';
import {
  buildExcelBuffer,
  type ExcelCellStyle,
} from '../../administrative/reports/helpers/report-excel.builder';
import { formatDateTimeCostaRica } from '../../administrative/reports/helpers/report-pdf.presentation';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';
import { ScheduleExportDto, ScheduleExportRowDto } from '../dto/schedule-export.dto';

export const SCHEDULE_EXPORT_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const;

const NAVY = 'FF1F4E79';
const TIME_FILL = 'FFEAF1F8';
const CLASS_FILL = 'FFF4F8FD';
const BREAK_FILL = 'FFFBF3E2';
const LUNCH_FILL = 'FFF6EBD3';
const BREAK_TEXT = 'FF7A5A1E';
const EMPTY_TEXT = 'FFB0B8C4';
const EMPTY_MARK = '—';
const LINE_HEIGHT = 15;

/** Etiqueta del bloque no lectivo: el nombre configurado o el genérico. */
function breakLabel(row: ScheduleExportRowDto): string {
  const name = row.label?.trim();
  if (name) return name;
  return row.kind === ScheduleSlotType.LUNCH ? 'Almuerzo' : 'Recreo';
}

/** Texto de una celda de clase: materia arriba y sección · docente debajo; varias lecciones separadas. */
export function scheduleCellText(entries: Array<{ title: string; detail?: string }>): string {
  if (entries.length === 0) return EMPTY_MARK;
  return entries
    .map((entry) => [entry.title.trim(), entry.detail?.trim()].filter(Boolean).join('\n'))
    .join('\n\n');
}

function lineCount(value: string | number): number {
  return String(value).split('\n').length;
}

@Injectable()
export class ScheduleExportService {
  async excel(dto: ScheduleExportDto): Promise<Buffer> {
    const rows: string[][] = dto.rows.map((row) => {
      const time = [row.time.trim(), row.kind === ScheduleSlotType.CLASS ? row.label?.trim() : null]
        .filter(Boolean)
        .join('\n');
      if (row.kind !== ScheduleSlotType.CLASS) {
        // Una sola celda combinada de lunes a viernes.
        return [time, breakLabel(row), '', '', '', ''];
      }
      return [time, ...row.days.map((day) => scheduleCellText(day.entries))];
    });

    const classRows = dto.rows.filter((row) => row.kind === ScheduleSlotType.CLASS);
    const assigned = classRows.reduce(
      (total, row) => total + row.days.filter((day) => day.entries.length > 0).length,
      0,
    );

    const filters = [
      `Curso lectivo: ${dto.periodLabel}`,
      `Docente: ${dto.teacherLabel?.trim() || 'Todos'}`,
      `Sección: ${dto.groupLabel?.trim() || 'Todas'}`,
    ].join(' · ');

    const focus =
      dto.groupLabel && dto.groupLabel !== 'Todas'
        ? ` · Sección ${dto.groupLabel}`
        : dto.teacherLabel && dto.teacherLabel !== 'Todos'
          ? ` · ${dto.teacherLabel}`
          : '';

    return buildExcelBuffer({
      sheetName: 'Horario',
      title: `Horario semanal${focus}`,
      generatedAt: formatDateTimeCostaRica(new Date()),
      recordCount: assigned,
      countLabel: 'Lecciones asignadas',
      appliedFilters: filters,
      columns: [
        { header: 'Hora', width: 17, align: 'center', wrapText: true },
        ...SCHEDULE_EXPORT_DAYS.map((day) => ({
          header: day,
          width: 30,
          align: 'center' as const,
          wrapText: true,
        })),
      ],
      rows,
      zebra: false,
      autoFilter: false,
      freezeFirstColumn: true,
      landscape: true,
      fitToOnePage: true,
      boldFirstLine: (index, column, value) =>
        column > 0 && dto.rows[index].kind === ScheduleSlotType.CLASS && value !== EMPTY_MARK,
      rowHeight: (index, values) => {
        if (dto.rows[index].kind !== ScheduleSlotType.CLASS) return 22;
        const lines = Math.max(2, ...values.map(lineCount));
        return lines * LINE_HEIGHT + 10;
      },
      rowMerge: (index) => (dto.rows[index].kind !== ScheduleSlotType.CLASS ? [2, 6] : undefined),
      cellStyle: (index, column, value): ExcelCellStyle => {
        const kind = dto.rows[index].kind;
        if (column === 0) {
          return { fill: TIME_FILL, bold: true, color: NAVY, align: 'center' };
        }
        if (kind !== ScheduleSlotType.CLASS) {
          return {
            fill: kind === ScheduleSlotType.LUNCH ? LUNCH_FILL : BREAK_FILL,
            italic: true,
            bold: true,
            color: BREAK_TEXT,
            align: 'center',
          };
        }
        if (value === EMPTY_MARK) return { color: EMPTY_TEXT, align: 'center' };
        return { fill: CLASS_FILL, color: NAVY, align: 'center' };
      },
    });
  }
}
