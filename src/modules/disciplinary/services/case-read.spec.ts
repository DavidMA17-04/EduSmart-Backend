import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { DeadlineIndicator, actorCanListCases, caseScopeClause, stepDeadline } from './case-read';
import { DisciplinaryActor } from './disciplinary-access.policy';

const actor = (partial: Partial<DisciplinaryActor>): DisciplinaryActor => ({
  userId: 4,
  permissions: [],
  roleNames: [],
  guideGroupIds: [],
  linkedStudentIds: [],
  ...partial,
});

describe('stepDeadline', () => {
  it('no asigna plazo cuando el paso todavía no tiene días hábiles', () => {
    expect(stepDeadline('2026-10-16', 0, '2026-10-19')).toEqual({
      dueOn: null,
      deadline: DeadlineIndicator.NONE,
    });
  });

  it('marca por vencer el mismo día del vencimiento y el día hábil anterior', () => {
    expect(stepDeadline('2026-10-16', 1, '2026-10-19').deadline).toBe(DeadlineIndicator.DUE_SOON);
    expect(stepDeadline('2026-10-16', 2, '2026-10-19')).toEqual({
      dueOn: '2026-10-20',
      deadline: DeadlineIndicator.DUE_SOON,
    });
  });

  it('marca en plazo cuando quedan más de un día hábil', () => {
    expect(stepDeadline('2026-10-16', 3, '2026-10-19')).toEqual({
      dueOn: '2026-10-21',
      deadline: DeadlineIndicator.ON_TIME,
    });
  });

  it('marca vencido y salta un feriado dentro del plazo', () => {
    const holidays = new Set(['2026-10-14']);
    expect(stepDeadline('2026-10-12', 2, '2026-10-16', holidays)).toEqual({
      dueOn: '2026-10-15',
      deadline: DeadlineIndicator.OVERDUE,
    });
  });
});

describe('caseScopeClause', () => {
  it('no restringe a quien tiene disciplinary.view', () => {
    expect(caseScopeClause(actor({ permissions: [PERMISSIONS.DISCIPLINARY_READ] }))).toBeNull();
    expect(actorCanListCases(actor({ permissions: [PERMISSIONS.DISCIPLINARY_READ] }))).toBe(true);
  });

  it('limita al docente a lo que reportó, a su sección guía y a sus estudiantes vinculados', () => {
    const scope = caseScopeClause(
      actor({
        permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN],
        guideGroupIds: [8],
        linkedStudentIds: [10, 11],
      }),
    );
    expect(scope?.sql).toContain('c.id_users_reporter = ?');
    expect(scope?.sql).toContain('c.id_groups IN (?)');
    expect(scope?.sql).toContain('c.id_users_student IN (?, ?)');
    expect(scope?.params).toEqual([4, 4, 8, 10, 11]);
  });

  it('niega el listado si no tiene view ni view_own', () => {
    expect(actorCanListCases(actor({ permissions: [PERMISSIONS.DISCIPLINARY_CREATE] }))).toBe(false);
  });
});
