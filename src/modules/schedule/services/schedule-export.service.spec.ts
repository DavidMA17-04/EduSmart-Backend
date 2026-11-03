import { Workbook } from 'exceljs';
import { ScheduleSlotType } from '../../../common/enums/schedule-slot-type.enum';
import { ScheduleExportDto } from '../dto/schedule-export.dto';
import { ScheduleExportService, scheduleCellText } from './schedule-export.service';

const empty = (): ScheduleExportDto['rows'][number]['days'] =>
  Array.from({ length: 5 }, () => ({ entries: [] }));

function payload(): ScheduleExportDto {
  const classDays = empty();
  classDays[0] = { entries: [{ title: 'Matemáticas', detail: '10-1 · María Fernández' }] };
  return {
    periodLabel: 'Curso 2026',
    teacherLabel: 'Todos',
    groupLabel: '10-1',
    rows: [
      { time: '07:00–07:40', label: 'Lección 1', kind: ScheduleSlotType.CLASS, days: classDays },
      { time: '08:20–08:35', label: 'Recreo', kind: ScheduleSlotType.BREAK, days: empty() },
      { time: '11:20–12:10', kind: ScheduleSlotType.LUNCH, days: empty() },
    ],
  };
}

async function load(buffer: Buffer) {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook.worksheets[0];
}

describe('ScheduleExportService', () => {
  const service = new ScheduleExportService();

  it('puts the subject on top and group/teacher underneath; empty cells get a dash', () => {
    expect(scheduleCellText([{ title: 'Matemáticas', detail: '10-1 · Ana' }])).toBe(
      'Matemáticas\n10-1 · Ana',
    );
    expect(scheduleCellText([])).toBe('—');
    expect(scheduleCellText([{ title: 'A' }, { title: 'B' }])).toBe('A\n\nB');
  });

  it('renders the institutional sheet: weekday header, wrapped lessons, merged breaks', async () => {
    const sheet = await load(await service.excel(payload()));
    const header = sheet.getRow(10).values as unknown[];
    expect(header.slice(1)).toEqual(['Hora', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
    expect(String(sheet.getCell('A5').value)).toBe('Horario semanal · Sección 10-1');
    expect(String(sheet.getCell('A7').value)).toBe('Lecciones asignadas: 1');

    const lesson = sheet.getCell('B11');
    expect(lesson.text).toBe('Matemáticas\n10-1 · María Fernández');
    const runs = (lesson.value as { richText: Array<{ text: string; font?: { bold?: boolean } }> })
      .richText;
    expect(runs[0]).toMatchObject({ text: 'Matemáticas', font: { bold: true } });
    expect(runs[1].font?.bold).toBeFalsy();
    expect(lesson.alignment?.wrapText).toBe(true);
    expect(sheet.getCell('A11').value).toBe('07:00–07:40\nLección 1');
    expect(sheet.getCell('C11').value).toBe('—');

    expect(sheet.getCell('B12').value).toBe('Recreo');
    expect(sheet.getCell('F12').isMerged).toBe(true);
    expect(sheet.getCell('B13').value).toBe('Almuerzo');
    expect(sheet.getRow(11).height).toBeGreaterThan(sheet.getRow(12).height ?? 0);
    expect(sheet.pageSetup.orientation).toBe('landscape');
    expect(sheet.pageSetup.fitToHeight).toBe(1);
    expect(sheet.autoFilter).toBeUndefined();
  });
});
