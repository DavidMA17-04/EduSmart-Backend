import { ForbiddenException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { ReportPdfBuilder } from '../../administrative/reports/helpers/report-pdf.builder';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { DisciplinaryExportService } from './disciplinary-export.service';

describe('exportación disciplinaria', () => {
  it('el Excel del listado trae solo los expedientes filtrados, con número, estudiante, gravedad, estado, rebajo y fechas', async () => {
    const list = jest.fn().mockResolvedValue({
      data: [listed('AM-2026-0008', 'Luis Mora')],
      total: 1,
      page: 1,
      pageSize: 100,
    });
    const buffer = await service({ list }).exportCasesExcel(orientador(), { groupId: 8, academicPeriodId: 4 });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9 }),
      expect.objectContaining({ groupId: 8, academicPeriodId: 4, page: 1, pageSize: 100 }),
    );
    const values = await sheetValues(buffer);
    expect(values).toEqual(expect.arrayContaining(['Número', 'Estudiante', 'Gravedad', 'Estado', 'Rebajo', 'Fecha del hecho', 'Vencimiento']));
    expect(values).toContain('AM-2026-0008');
    expect(values).toContain('Luis Mora');
    expect(values).toContain('Grave');
    expect(values).toContain('Firme');
    expect(values).toContain('Rebajo aplicado: 20 puntos');
    expect(values).not.toContain('AM-2026-0099');
  });

  it('recorre todas las páginas del alcance y no agrega expedientes fuera de la consulta', async () => {
    const list = jest
      .fn()
      .mockResolvedValueOnce({
        data: [listed('AM-2026-0001', 'Ana')],
        total: 101,
        page: 1,
        pageSize: 100,
      })
      .mockResolvedValueOnce({
        data: [listed('AM-2026-0101', 'Ana')],
        total: 101,
        page: 2,
        pageSize: 100,
      });
    const buffer = await service({ list }).exportCasesExcel(orientador(), {});
    expect(list).toHaveBeenCalledTimes(2);
    const values = await sheetValues(buffer);
    expect(values).toContain('AM-2026-0001');
    expect(values).toContain('AM-2026-0101');
  });

  it('si la bandeja niega el alcance, la exportación también lo niega', async () => {
    const list = jest.fn().mockRejectedValue(new ForbiddenException('No tiene acceso a los expedientes'));
    await expect(service({ list }).exportCasesPdf(orientador(), {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('el historial en Excel incluye la nota del período y el PDF del expediente trae cronología, resolución y recurso', async () => {
    const history = jest.fn().mockResolvedValue({
      student: { fullName: 'Luis Mora' },
      periods: [
        {
          periodName: '2026',
          conductGrade: 70,
          cases: [
            {
              caseNumber: 'AM-2026-0008',
              status: 'FIRM',
              severityLabel: 'Grave',
              deductionLabel: 'Rebajo aplicado: 20 puntos',
            },
          ],
        },
      ],
    });
    const findOne = jest.fn().mockResolvedValue({
      caseNumber: 'AM-2026-0008',
      status: 'FIRM',
      severity: 'SERIOUS',
      severityLabel: 'Grave',
      deduction: 20,
      student: { fullName: 'Luis Mora', nationalId: '101110111' },
      sectionName: 'A',
      gradeLevel: 10,
      infractionType: { name: 'Agresión' },
      description: 'Empujó a un compañero.',
      place: 'Aula',
      occurredAt: '2026-03-02T18:00:00.000Z',
      resolutionOutcome: 'UPHOLD',
      resolutionReasoning: 'Se mantiene la falta porque el descargo no la desvirtúa.',
      events: [{ type: 'CASE_OPENED', actorName: 'Ana Sol', createdAt: '2026-03-03T18:00:00.000Z', payload: null }],
      appeals: [{ kind: 'REVOCATION', isSubsidiary: true, outcome: 'UPHOLD', body: 'Pide revocar.', reasoning: 'Se rechaza.' }],
    });
    const exports = service({ history, findOne });
    const sheet = await sheetValues(await exports.exportHistoryExcel(orientador(), 10, {}));
    expect(sheet).toContain('AM-2026-0008');
    expect(sheet).toContain(70);

    const tables: string[][][] = [];
    const drawTable = ReportPdfBuilder.prototype.drawTable;
    const spy = jest.spyOn(ReportPdfBuilder.prototype, 'drawTable').mockImplementation(function (
      this: ReportPdfBuilder,
      columns,
      rows,
    ) {
      tables.push(rows);
      return drawTable.call(this, columns, rows);
    });
    const pdf = await exports.exportCasePdf(orientador(), 8);
    spy.mockRestore();
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }), 8);
    const flat = tables.flat(2).join(' ');
    expect(flat).toContain('Empujó a un compañero.');
    expect(flat).toContain('Apertura');
    expect(flat).toContain('Se mantiene la falta porque el descargo no la desvirtúa.');
    expect(flat).toContain('Se rechaza.');
  });

  it('el historial y el expediente exportados no amplían el alcance de la consulta', async () => {
    const history = jest.fn().mockRejectedValue(new ForbiddenException('No tiene acceso al historial de este estudiante'));
    const findOne = jest.fn().mockRejectedValue(new ForbiddenException('No tiene acceso a este expediente'));
    const exports = service({ history, findOne });
    const actor = { id: 7, roles: ['Docente'], permissions: [PERMISSIONS.DISCIPLINARY_EXPORT, PERMISSIONS.DISCIPLINARY_VIEW_OWN] };
    await expect(exports.exportHistoryExcel(actor as never, 99, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(history).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), 99, {});
    await expect(exports.exportCasePdf(actor as never, 3)).rejects.toBeInstanceOf(ForbiddenException);
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), 3);
  });
});

function orientador() {
  return { id: 9, roles: ['Orientador'], permissions: [PERMISSIONS.DISCIPLINARY_EXPORT, PERMISSIONS.DISCIPLINARY_READ] } as never;
}

function service(methods: Record<string, unknown>) {
  return new DisciplinaryExportService(methods as never);
}

function listed(caseNumber: string, studentFullName: string) {
  return {
    caseNumber,
    status: 'FIRM',
    severity: 'SERIOUS',
    severityLabel: 'Grave',
    studentFullName,
    occurredAt: '2026-03-02T18:00:00.000Z',
    dueOn: '2026-03-20',
  };
}

async function sheetValues(buffer: Buffer): Promise<unknown[]> {
  const book = new Workbook();
  await book.xlsx.load(buffer as unknown as ArrayBuffer);
  const values: unknown[] = [];
  book.worksheets[0].eachRow((row) => {
    values.push(...(row.values as unknown[]));
  });
  return values;
}
