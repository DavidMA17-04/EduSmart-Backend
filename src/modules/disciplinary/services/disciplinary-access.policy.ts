import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import {
  INSTITUTIONAL_ROLE_ADMIN,
  INSTITUTIONAL_ROLE_COUNSELOR,
  INSTITUTIONAL_ROLE_DIRECTOR,
} from '../../../common/constants/institutional-roles.constant';
import { EventVisibility } from '../constants/disciplinary.enums';

export interface DisciplinaryActor {
  userId: number;
  permissions: readonly string[];
  roleNames: readonly string[];
  /** Secciones donde el actor es docente guía. */
  guideGroupIds: readonly number[];
  /** Estudiantes vinculados cuando el actor es encargado. */
  linkedStudentIds: readonly number[];
}

export interface CaseAccessFacts {
  studentUserId: number;
  reporterUserId: number;
  responsibleUserId: number | null;
  groupId: number;
}

export interface CaseEventAccessFacts {
  visibility: EventVisibility;
}

const RESERVED_ROLES = new Set<string>([
  INSTITUTIONAL_ROLE_COUNSELOR,
  INSTITUTIONAL_ROLE_DIRECTOR,
  INSTITUTIONAL_ROLE_ADMIN,
]);

export function canViewAllCases(actor: DisciplinaryActor): boolean {
  return actor.permissions.includes(PERMISSIONS.DISCIPLINARY_READ);
}

/** `view` o `view_own`: basta uno. El alcance de `view_own` se resuelve aquí. */
export function canViewStudentHistory(
  actor: DisciplinaryActor,
  studentUserId: number,
  studentGroupIds: readonly number[],
): boolean {
  if (canViewAllCases(actor)) return true;
  if (!actor.permissions.includes(PERMISSIONS.DISCIPLINARY_VIEW_OWN)) return false;
  if (studentUserId === actor.userId) return true;
  if (actor.linkedStudentIds.includes(studentUserId)) return true;
  return studentGroupIds.some((groupId) => actor.guideGroupIds.includes(groupId));
}

export function canViewCase(actor: DisciplinaryActor, facts: CaseAccessFacts): boolean {
  if (canViewAllCases(actor)) return true;
  if (!actor.permissions.includes(PERMISSIONS.DISCIPLINARY_VIEW_OWN)) return false;
  if (facts.studentUserId === actor.userId) return true;
  if (facts.reporterUserId === actor.userId) return true;
  if (actor.guideGroupIds.includes(facts.groupId)) return true;
  return actor.linkedStudentIds.includes(facts.studentUserId);
}

export function canSeeReserved(actor: DisciplinaryActor, facts: CaseAccessFacts): boolean {
  if (facts.responsibleUserId === actor.userId) return true;
  return actor.roleNames.some((role) => RESERVED_ROLES.has(role));
}

export function visibleWitnesses(
  actor: DisciplinaryActor,
  facts: CaseAccessFacts,
  witnesses: string | null,
): string | null {
  return canSeeReserved(actor, facts) ? witnesses : null;
}

export function visibleEvents<T extends CaseEventAccessFacts>(
  actor: DisciplinaryActor,
  facts: CaseAccessFacts,
  events: readonly T[],
): T[] {
  if (canSeeReserved(actor, facts)) return [...events];
  return events.filter((event) => event.visibility !== EventVisibility.RESERVED);
}
