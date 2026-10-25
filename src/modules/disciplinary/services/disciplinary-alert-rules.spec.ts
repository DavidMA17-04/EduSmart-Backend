import { DisciplinaryCaseStatus } from '../constants/disciplinary.enums';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { DisciplinaryActor } from './disciplinary-access.policy';
import {
  buildDisciplinaryAlerts,
  DUE_SOON_ALERT,
  LOW_CONDUCT_ALERT,
  MISSING_GUIDE_ALERT,
  OVERDUE_ALERT,
  RECIDIVISM_ALERT,
  YEAR_WITHOUT_HOLIDAYS_ALERT,
  type AlertCaseFact,
} from './disciplinary-alert-rules';

const TODAY = '2026-10-19';

describe('reglas de alertas disciplinarias', () => {
  it('avisa reincidencia al tercer expediente, nota baja y plazo vencido al guía de la sección', () => {
    const alerts = buildDisciplinaryAlerts({
      actor: guide(),
      cases: [
        fact({ id: 1, status: DisciplinaryCaseStatus.FIRM, severity: InfractionSeverity.SERIOUS }),
        fact({ id: 2, status: DisciplinaryCaseStatus.RESOLVED, severity: InfractionSeverity.MINOR }),
        fact({
          id: 3,
          status: DisciplinaryCaseStatus.INVESTIGATING,
          severity: InfractionSeverity.SERIOUS,
          stepStartedOn: '2026-10-01',
          stepBusinessDays: 3,
        }),
      ],
      unconfirmed: [],
      recidivismThreshold: 3,
      conductAlertThreshold: 80,
      today: TODAY,
      holidays: new Set(),
    });
    expect(alerts.map((item) => item.message)).toEqual([RECIDIVISM_ALERT, LOW_CONDUCT_ALERT, OVERDUE_ALERT]);
    expect(alerts.find((item) => item.code === 'LOW_CONDUCT')?.conductGrade).toBe(80);
    expect(alerts.some((item) => item.code === 'YEAR_WITHOUT_HOLIDAYS')).toBe(false);
  });

  it('dos expedientes no son reincidencia y un resuelto no baja la nota', () => {
    const alerts = buildDisciplinaryAlerts({
      actor: guide(),
      cases: [
        fact({ id: 1, status: DisciplinaryCaseStatus.FIRM, severity: InfractionSeverity.MINOR }),
        fact({ id: 2, status: DisciplinaryCaseStatus.RESOLVED, severity: InfractionSeverity.SERIOUS }),
      ],
      unconfirmed: [],
      recidivismThreshold: 3,
      conductAlertThreshold: 80,
      today: TODAY,
      holidays: new Set(['2026-10-15']),
    });
    expect(alerts).toEqual([]);
  });

  it('un anulado no cuenta para la reincidencia y el plazo por vencer se marca el día del vencimiento', () => {
    const alerts = buildDisciplinaryAlerts({
      actor: guide(),
      cases: [
        fact({ id: 1 }),
        fact({ id: 2, status: DisciplinaryCaseStatus.ANNULLED }),
        fact({
          id: 4,
          stepStartedOn: '2026-10-16',
          stepBusinessDays: 1,
        }),
      ],
      unconfirmed: [],
      recidivismThreshold: 3,
      conductAlertThreshold: 80,
      today: TODAY,
      holidays: new Set(['2026-10-15']),
    });
    expect(alerts.map((item) => item.message)).toEqual([DUE_SOON_ALERT]);
  });

  it('Orientación ve la sección sin guía y el año sin días no hábiles; el guía de otra sección no', () => {
    const cases = [
      fact({
        id: 9,
        groupId: 4,
        missingGuideTeacher: true,
        responsibleUserId: null,
        stepBusinessDays: 0,
      }),
    ];
    const shared = {
      cases,
      unconfirmed: [],
      recidivismThreshold: 3,
      conductAlertThreshold: 80,
      today: TODAY,
      holidays: new Set<string>(),
    };
    const institutional = buildDisciplinaryAlerts({ ...shared, actor: counselor() });
    expect(institutional.map((item) => item.message)).toEqual([YEAR_WITHOUT_HOLIDAYS_ALERT, MISSING_GUIDE_ALERT]);
    expect(buildDisciplinaryAlerts({ ...shared, actor: guide() })).toEqual([]);
  });
});

function guide(): DisciplinaryActor {
  return {
    userId: 7,
    permissions: ['disciplinary.view_own'],
    roleNames: ['Docente'],
    guideGroupIds: [8],
    linkedStudentIds: [],
  };
}

function counselor(): DisciplinaryActor {
  return {
    userId: 9,
    permissions: ['disciplinary.view'],
    roleNames: ['Orientador'],
    guideGroupIds: [],
    linkedStudentIds: [],
  };
}

function fact(partial: Partial<AlertCaseFact> & Pick<AlertCaseFact, 'id'>): AlertCaseFact {
  return {
    caseNumber: `AM-2026-000${partial.id}`,
    studentUserId: 10,
    groupId: 8,
    academicPeriodId: 4,
    status: DisciplinaryCaseStatus.REPORTED,
    severity: InfractionSeverity.SERIOUS,
    responsibleUserId: 7,
    missingGuideTeacher: false,
    stepStartedOn: '2026-10-19',
    stepBusinessDays: 10,
    ...partial,
  };
}
