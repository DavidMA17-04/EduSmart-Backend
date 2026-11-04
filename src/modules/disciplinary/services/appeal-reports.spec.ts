import { AppealKind, AppealOutcome, DisciplinaryCaseStatus } from '../constants/disciplinary.enums';
import { DeadlineIndicator } from './case-read';
import { appealDeadlineReportLabel, appealKindReportLabel, appealOutcomeReportLabel, buildAppealDashboard, emptyAppealDashboard } from './appeal-reports';

describe('indicadores de recursos', () => {
  it('cuenta pendientes, resueltos, plazos, tipos y resultados sin inventar métricas', () => {
    const board = buildAppealDashboard([
      item({ kind: AppealKind.REVOCATION, outcome: null, deadline: DeadlineIndicator.ON_TIME }),
      item({ kind: AppealKind.REVOCATION, outcome: AppealOutcome.UPHOLD, deadline: DeadlineIndicator.NONE }),
      item({ kind: AppealKind.APPEAL, outcome: null, deadline: DeadlineIndicator.OVERDUE }),
      item({ kind: AppealKind.APPEAL, outcome: AppealOutcome.MODIFY, deadline: DeadlineIndicator.NONE, caseStatus: DisciplinaryCaseStatus.FIRM }),
    ]);
    expect(board).toMatchObject({
      total: 4,
      pending: 2,
      resolved: 2,
      onTime: 1,
      overdue: 1,
      dueSoon: 0,
      byKind: { REVOCATION: 2, APPEAL: 2 },
      byOutcome: { PENDING: 2, UPHOLD: 1, REVOKE: 0, MODIFY: 1 },
    });
    expect(board.byCaseStatus.IN_APPEAL).toBe(3);
    expect(board.byCaseStatus.FIRM).toBe(1);
    expect(JSON.stringify(board)).not.toMatch(/beca|nota académica|ape-/i);
  });

  it('un conjunto vacío deja todos los conteos en cero', () => {
    expect(buildAppealDashboard([])).toEqual(emptyAppealDashboard());
  });

  it('etiqueta tipo y resultado en español', () => {
    expect(appealKindReportLabel(AppealKind.REVOCATION, true)).toBe('Revocatoria con apelación en subsidio');
    expect(appealOutcomeReportLabel(null)).toBe('Pendiente');
    expect(appealOutcomeReportLabel(AppealOutcome.REVOKE)).toBe('Acoge');
    expect(appealDeadlineReportLabel(DeadlineIndicator.DUE_SOON)).toBe('Por vencer');
  });
});

function item(partial: Partial<{ kind: AppealKind; outcome: AppealOutcome | null; deadline: DeadlineIndicator; caseStatus: DisciplinaryCaseStatus }>) {
  return {
    kind: AppealKind.REVOCATION,
    outcome: null,
    deadline: DeadlineIndicator.NONE,
    caseStatus: DisciplinaryCaseStatus.IN_APPEAL,
    ...partial,
  };
}
