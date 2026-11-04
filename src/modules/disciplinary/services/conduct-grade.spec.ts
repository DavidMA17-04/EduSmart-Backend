import { DisciplinaryCaseStatus } from '../constants/disciplinary.enums';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { buildConductHistory, type ConductCaseInput } from './conduct-grade';

function entry(
  partial: Partial<ConductCaseInput> & Pick<ConductCaseInput, 'id' | 'status' | 'severity'>,
): ConductCaseInput {
  return {
    caseNumber: `AM-2026-000${partial.id}`,
    track: 'DUE_PROCESS',
    academicPeriodId: 1,
    periodName: '2026',
    occurredAt: '2026-03-01T18:00:00.000Z',
    infractionName: 'Falta',
    ...partial,
  };
}

describe('nota de conducta', () => {
  it('descuenta solo los firmes del período: leve y grave dejan 70', () => {
    const [period] = buildConductHistory([
      entry({ id: 1, status: DisciplinaryCaseStatus.FIRM, severity: InfractionSeverity.MINOR }),
      entry({ id: 2, status: DisciplinaryCaseStatus.FIRM, severity: InfractionSeverity.SERIOUS }),
    ]);
    expect(period.conductGrade).toBe(70);
    expect(period.appliedDeduction).toBe(30);
    expect(period.cases.map((item) => item.deductionLabel)).toEqual([
      'Rebajo aplicado: 10 puntos',
      'Rebajo aplicado: 20 puntos',
    ]);
  });

  it('un expediente resuelto no descuenta y muestra el rebajo como propuesto', () => {
    const [period] = buildConductHistory([
      entry({ id: 1, status: DisciplinaryCaseStatus.RESOLVED, severity: InfractionSeverity.SERIOUS }),
    ]);
    expect(period.conductGrade).toBe(100);
    expect(period.cases[0].deductionState).toBe('PROPOSED');
    expect(period.cases[0].deductionLabel).toBe('Rebajo propuesto: 20 puntos');
  });

  it('desestimado y anulado no descuentan y la nota recupera el rebajo', () => {
    const [period] = buildConductHistory([
      entry({ id: 1, status: DisciplinaryCaseStatus.FIRM, severity: InfractionSeverity.MINOR }),
      entry({ id: 2, status: DisciplinaryCaseStatus.ANNULLED, severity: InfractionSeverity.SERIOUS }),
      entry({ id: 3, status: DisciplinaryCaseStatus.DISMISSED, severity: InfractionSeverity.VERY_SERIOUS }),
    ]);
    expect(period.conductGrade).toBe(90);
    expect(period.cases.filter((item) => item.deductionState === 'NONE').map((item) => item.deduction)).toEqual([0, 0]);
  });

  it('no baja de 0 y el filtro de estado no esconde el rebajo firme del período', () => {
    const [capped] = buildConductHistory([
      entry({ id: 1, status: DisciplinaryCaseStatus.FIRM, severity: InfractionSeverity.EXTREMELY_SERIOUS }),
      entry({ id: 2, status: DisciplinaryCaseStatus.FIRM, severity: InfractionSeverity.EXTREMELY_SERIOUS }),
      entry({ id: 3, status: DisciplinaryCaseStatus.FIRM, severity: InfractionSeverity.EXTREMELY_SERIOUS }),
    ]);
    expect(capped.conductGrade).toBe(0);

    const [filtered] = buildConductHistory(
      [
        entry({ id: 1, status: DisciplinaryCaseStatus.FIRM, severity: InfractionSeverity.MINOR }),
        entry({ id: 2, status: DisciplinaryCaseStatus.RESOLVED, severity: InfractionSeverity.SERIOUS }),
      ],
      { status: DisciplinaryCaseStatus.RESOLVED },
    );
    expect(filtered.cases).toHaveLength(1);
    expect(filtered.conductGrade).toBe(90);
  });
});
