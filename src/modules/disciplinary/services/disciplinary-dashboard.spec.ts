import { DisciplinaryCaseStatus } from '../constants/disciplinary.enums';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { buildDashboard, type DashboardCaseFact } from './disciplinary-dashboard';
import { YEAR_WITHOUT_HOLIDAYS_ALERT } from './disciplinary-alert-rules';

describe('tablero disciplinario', () => {
  it('agrupa por estado, gravedad, sección y mes, y cuenta plazos y estudiantes', () => {
    const board = buildDashboard(
      [
        fact({ id: 1, status: DisciplinaryCaseStatus.FIRM, severity: InfractionSeverity.MINOR, month: '2026-03' }),
        fact({
          id: 2,
          status: DisciplinaryCaseStatus.INVESTIGATING,
          severity: InfractionSeverity.SERIOUS,
          month: '2026-04',
          stepStartedOn: '2026-10-01',
          stepBusinessDays: 3,
        }),
        fact({
          id: 3,
          studentUserId: 11,
          studentFullName: 'María Sol',
          groupId: 9,
          sectionLabel: '11-B',
          stepStartedOn: '2026-10-16',
          stepBusinessDays: 1,
        }),
      ],
      [
        { code: 'RECIDIVISM', message: 'Reincidencia', studentUserId: 10, groupId: 8 },
        { code: 'RECIDIVISM', message: 'Reincidencia', studentUserId: 99, groupId: 3 },
        { code: 'YEAR_WITHOUT_HOLIDAYS', message: YEAR_WITHOUT_HOLIDAYS_ALERT },
      ],
      '2026-10-19',
      new Set(),
      true,
    );

    expect(board.total).toBe(3);
    expect(board.byStatus.map((item) => item.label)).toEqual(['Reportada', 'En investigación', 'Firme']);
    expect(board.bySeverity.map((item) => [item.label, item.count])).toEqual([
      ['Leve', 1],
      ['Grave', 2],
    ]);
    expect(board.bySection.map((item) => item.sectionLabel)).toEqual(['10-A', '11-B']);
    expect(board.byMonth).toEqual([
      { month: '2026-03', count: 2 },
      { month: '2026-04', count: 1 },
    ]);
    expect(board.deadlines).toEqual({ dueSoon: 1, overdue: 1 });
    expect(board.topStudents).toEqual([
      { studentUserId: 10, fullName: 'Luis Mora', count: 2 },
      { studentUserId: 11, fullName: 'María Sol', count: 1 },
    ]);
    expect(board.alerts).toHaveLength(2);
    expect(board.alerts.some((item) => item.studentUserId === 99)).toBe(false);
  });
});

function fact(partial: Partial<DashboardCaseFact> & Pick<DashboardCaseFact, 'id'>): DashboardCaseFact {
  return {
    status: DisciplinaryCaseStatus.REPORTED,
    severity: InfractionSeverity.SERIOUS,
    studentUserId: 10,
    studentFullName: 'Luis Mora',
    groupId: 8,
    sectionLabel: '10-A',
    month: '2026-03',
    stepStartedOn: '2026-10-19',
    stepBusinessDays: 10,
    ...partial,
  };
}
