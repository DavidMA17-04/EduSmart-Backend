import { DisciplinaryCaseStatus } from '../constants/disciplinary.enums';
import { getSeverityRule, InfractionSeverity } from '../constants/infraction-severity.constant';
import { CONDUCT_BASE_GRADE } from './conduct-grade';
import { canViewAllCases, DisciplinaryActor } from './disciplinary-access.policy';
import { stepDeadline } from './case-read';

export const RECIDIVISM_ALERT = 'Reincidencia';
export const LOW_CONDUCT_ALERT = 'Nota de conducta baja';
export const DUE_SOON_ALERT = 'Plazo por vencer';
export const OVERDUE_ALERT = 'Plazo vencido';
export const MISSING_GUIDE_ALERT = 'Sin docente guía';
export const YEAR_WITHOUT_HOLIDAYS_ALERT = 'El año en curso no tiene días no hábiles';

const FINAL_STATUSES = new Set<DisciplinaryCaseStatus>([
  DisciplinaryCaseStatus.FIRM,
  DisciplinaryCaseStatus.DISMISSED,
  DisciplinaryCaseStatus.ANNULLED,
]);

export interface AlertCaseFact {
  id: number;
  caseNumber: string;
  studentUserId: number;
  groupId: number;
  academicPeriodId: number;
  status: DisciplinaryCaseStatus;
  severity: InfractionSeverity;
  responsibleUserId: number | null;
  missingGuideTeacher: boolean;
  stepStartedOn: string;
  stepBusinessDays: number;
}

export interface DisciplinaryAlert {
  code:
    | 'RECIDIVISM'
    | 'LOW_CONDUCT'
    | 'DEADLINE_DUE_SOON'
    | 'DEADLINE_OVERDUE'
    | 'UNCONFIRMED_NOTIFICATION'
    | 'MISSING_GUIDE'
    | 'YEAR_WITHOUT_HOLIDAYS';
  message: string;
  caseId?: number;
  caseNumber?: string;
  studentUserId?: number;
  academicPeriodId?: number;
  groupId?: number;
  conductGrade?: number;
  notificationId?: number;
  fullName?: string;
}

export function yearHasNonWorkingDay(today: string, holidays: ReadonlySet<string>): boolean {
  const year = today.slice(0, 4);
  for (const day of holidays) {
    if (day.slice(0, 4) === year) return true;
  }
  return false;
}

export function buildDisciplinaryAlerts(input: {
  actor: DisciplinaryActor;
  cases: readonly AlertCaseFact[];
  unconfirmed: readonly DisciplinaryAlert[];
  recidivismThreshold: number;
  conductAlertThreshold: number;
  today: string;
  holidays: ReadonlySet<string>;
}): DisciplinaryAlert[] {
  const alerts: DisciplinaryAlert[] = [];
  if (canViewAllCases(input.actor) && !yearHasNonWorkingDay(input.today, input.holidays)) {
    alerts.push({ code: 'YEAR_WITHOUT_HOLIDAYS', message: YEAR_WITHOUT_HOLIDAYS_ALERT });
  }

  const buckets = new Map<string, AlertCaseFact[]>();
  for (const row of input.cases) {
    if (row.status === DisciplinaryCaseStatus.ANNULLED) continue;
    const key = `${row.studentUserId}:${row.academicPeriodId}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(row);
    buckets.set(key, bucket);
  }

  for (const bucket of buckets.values()) {
    const sample = bucket[0];
    if (!seesGroup(input.actor, bucket)) continue;
    if (bucket.length >= input.recidivismThreshold) {
      alerts.push({
        code: 'RECIDIVISM',
        message: RECIDIVISM_ALERT,
        studentUserId: sample.studentUserId,
        academicPeriodId: sample.academicPeriodId,
        groupId: sample.groupId,
      });
    }
    const applied = bucket.reduce(
      (sum, row) => sum + (row.status === DisciplinaryCaseStatus.FIRM ? getSeverityRule(row.severity).deduction : 0),
      0,
    );
    const grade = Math.max(0, CONDUCT_BASE_GRADE - applied);
    if (applied > 0 && grade <= input.conductAlertThreshold) {
      alerts.push({
        code: 'LOW_CONDUCT',
        message: LOW_CONDUCT_ALERT,
        studentUserId: sample.studentUserId,
        academicPeriodId: sample.academicPeriodId,
        groupId: sample.groupId,
        conductGrade: grade,
      });
    }
  }

  for (const row of input.cases) {
    if (FINAL_STATUSES.has(row.status)) continue;
    if (row.missingGuideTeacher && (canViewAllCases(input.actor) || row.responsibleUserId === input.actor.userId)) {
      alerts.push({
        code: 'MISSING_GUIDE',
        message: MISSING_GUIDE_ALERT,
        caseId: row.id,
        caseNumber: row.caseNumber,
        studentUserId: row.studentUserId,
        groupId: row.groupId,
      });
    }
    if (!seesCase(input.actor, row)) continue;
    const deadline = stepDeadline(row.stepStartedOn, row.stepBusinessDays, input.today, input.holidays);
    if (deadline.deadline === 'DUE_SOON' || deadline.deadline === 'OVERDUE') {
      alerts.push({
        code: deadline.deadline === 'DUE_SOON' ? 'DEADLINE_DUE_SOON' : 'DEADLINE_OVERDUE',
        message: deadline.deadline === 'DUE_SOON' ? DUE_SOON_ALERT : OVERDUE_ALERT,
        caseId: row.id,
        caseNumber: row.caseNumber,
        studentUserId: row.studentUserId,
        groupId: row.groupId,
      });
    }
  }

  alerts.push(...input.unconfirmed);
  return alerts;
}

function seesGroup(actor: DisciplinaryActor, cases: readonly AlertCaseFact[]): boolean {
  if (canViewAllCases(actor)) return true;
  return cases.some((row) => actor.guideGroupIds.includes(row.groupId));
}

function seesCase(actor: DisciplinaryActor, row: AlertCaseFact): boolean {
  if (canViewAllCases(actor)) return true;
  if (row.responsibleUserId != null && row.responsibleUserId === actor.userId) return true;
  return actor.guideGroupIds.includes(row.groupId);
}
