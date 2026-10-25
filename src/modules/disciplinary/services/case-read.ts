import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { addBusinessDays, businessDaysBetween } from '../utils/business-days';
import { canViewAllCases, DisciplinaryActor } from './disciplinary-access.policy';

export enum DeadlineIndicator {
  ON_TIME = 'ON_TIME',
  DUE_SOON = 'DUE_SOON',
  OVERDUE = 'OVERDUE',
  NONE = 'NONE',
}

export interface StepDeadline {
  dueOn: string | null;
  deadline: DeadlineIndicator;
}

/** Vencimiento del paso actual. `stepBusinessDays <= 0` significa que el paso aún no tiene plazo. */
export function stepDeadline(
  stepStartedOn: string,
  stepBusinessDays: number,
  today: string,
  nonWorkingDays: ReadonlySet<string> = new Set(),
): StepDeadline {
  if (stepBusinessDays <= 0 || !stepStartedOn) {
    return { dueOn: null, deadline: DeadlineIndicator.NONE };
  }
  const dueOn = addBusinessDays(stepStartedOn, stepBusinessDays, nonWorkingDays);
  if (today > dueOn) return { dueOn, deadline: DeadlineIndicator.OVERDUE };
  const remaining = businessDaysBetween(today, dueOn, nonWorkingDays);
  return {
    dueOn,
    deadline: remaining <= 1 ? DeadlineIndicator.DUE_SOON : DeadlineIndicator.ON_TIME,
  };
}

/** `null` cuando el actor ve todos los expedientes. */
export function caseScopeClause(actor: DisciplinaryActor): { sql: string; params: number[] } | null {
  if (canViewAllCases(actor)) return null;
  const parts = ['c.id_users_student = ?', 'c.id_users_reporter = ?'];
  const params: number[] = [actor.userId, actor.userId];
  if (actor.guideGroupIds.length > 0) {
    parts.push(`c.id_groups IN (${actor.guideGroupIds.map(() => '?').join(', ')})`);
    params.push(...actor.guideGroupIds);
  }
  if (actor.linkedStudentIds.length > 0) {
    parts.push(`c.id_users_student IN (${actor.linkedStudentIds.map(() => '?').join(', ')})`);
    params.push(...actor.linkedStudentIds);
  }
  return { sql: `(${parts.join(' OR ')})`, params };
}

export function actorCanListCases(actor: DisciplinaryActor): boolean {
  return canViewAllCases(actor) || actor.permissions.includes(PERMISSIONS.DISCIPLINARY_VIEW_OWN);
}
