import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { INSTITUTIONAL_ROLE_ADMIN } from '../../../common/constants/institutional-roles.constant';
import { Role } from '../../../common/enums/role.enum';
import { AppealKind, AppealOutcome, DisciplinaryCaseStatus, DisciplinaryTrack } from '../constants/disciplinary.enums';
import { addBusinessDays } from '../utils/business-days';
import { DisciplinaryActor } from './disciplinary-access.policy';
import { canConductInvestigation } from './investigation';

export interface AppealFact {
  kind: AppealKind;
  isSubsidiary: boolean;
  outcome: AppealOutcome | null;
}

export interface RemedyWindowInput {
  track: DisciplinaryTrack;
  status: DisciplinaryCaseStatus;
  stepStartedOn: string;
  stepBusinessDays: number;
  appeals: readonly AppealFact[];
}

/** Encargado vinculado o quien S4 ya autoriza a interponer (responsable, Dirección, admin). */
export function canFileDisciplinaryRemedy(
  actor: DisciplinaryActor,
  studentUserId: number,
  responsibleUserId: number | null,
): boolean {
  if (canConductInvestigation(actor, responsibleUserId)) return true;
  return actor.linkedStudentIds.includes(studentUserId);
}

/** Misma ventana que `assertRevocationWindow` en DisciplinaryAppealsService. */
export function isRevocationStage(track: DisciplinaryTrack, status: DisciplinaryCaseStatus): boolean {
  const direct = track === DisciplinaryTrack.DIRECT && status === DisciplinaryCaseStatus.NOTIFIED;
  const resolved = track === DisciplinaryTrack.DUE_PROCESS && status === DisciplinaryCaseStatus.RESOLVED;
  return direct || resolved;
}

/** Misma secuencia que `fileAppeal`: solo tras rechazo de revocatoria, sin subsidio. */
export function isStandaloneAppealStage(
  status: DisciplinaryCaseStatus,
  appeals: readonly AppealFact[],
): boolean {
  if (status !== DisciplinaryCaseStatus.IN_APPEAL) return false;
  const revocation = appeals.find((item) => item.kind === AppealKind.REVOCATION);
  if (!revocation || revocation.outcome !== AppealOutcome.UPHOLD) return false;
  if (revocation.isSubsidiary) return false;
  return !appeals.some((item) => item.kind === AppealKind.APPEAL);
}

/** Misma regla que `assertOnTime`: el reloj vive en el expediente. */
export function isRemedyOnTime(
  stepStartedOn: string,
  stepBusinessDays: number,
  today: string,
  nonWorkingDays: ReadonlySet<string> = new Set(),
): boolean {
  if (stepBusinessDays <= 0 || !stepStartedOn) return false;
  const dueOn = addBusinessDays(stepStartedOn, stepBusinessDays, nonWorkingDays);
  return today <= dueOn;
}

export type EligibleRemedyKind = AppealKind.REVOCATION | AppealKind.APPEAL;

export function eligibleRemedyKind(
  input: RemedyWindowInput,
  today: string,
  nonWorkingDays: ReadonlySet<string> = new Set(),
): EligibleRemedyKind | null {
  if (!isRemedyOnTime(input.stepStartedOn, input.stepBusinessDays, today, nonWorkingDays)) {
    return null;
  }
  const hasRevocation = input.appeals.some((item) => item.kind === AppealKind.REVOCATION);
  if (isRevocationStage(input.track, input.status) && !hasRevocation) {
    return AppealKind.REVOCATION;
  }
  if (isStandaloneAppealStage(input.status, input.appeals)) {
    return AppealKind.APPEAL;
  }
  return null;
}

/** Misma potestad que `assertResolver` + admin en DisciplinaryAppealsService. */
export function actorHasAdminPower(actor: DisciplinaryActor): boolean {
  return actor.roleNames.includes(Role.ADMIN) || actor.roleNames.includes(INSTITUTIONAL_ROLE_ADMIN);
}

function actorHasResolverPermission(actor: DisciplinaryActor, permission: string): boolean {
  return actorHasAdminPower(actor) || actor.permissions.includes(permission);
}

/** Puede abrir la bandeja: permiso de resolver revocatoria o apelación, o admin. */
export function actorCanReviewQueue(actor: DisciplinaryActor): boolean {
  return (
    actorHasResolverPermission(actor, PERMISSIONS.DISCIPLINARY_RESOLVE) ||
    actorHasResolverPermission(actor, PERMISSIONS.DISCIPLINARY_APPEAL)
  );
}

/** Revocatoria: `disciplinary.resolve` y ser quien dictó el acto, o admin. */
export function canResolveDisciplinaryRevocation(
  actor: DisciplinaryActor,
  responsibleUserId: number | null,
): boolean {
  if (!actorHasResolverPermission(actor, PERMISSIONS.DISCIPLINARY_RESOLVE)) return false;
  if (actorHasAdminPower(actor)) return true;
  return responsibleUserId != null && responsibleUserId === actor.userId;
}

/** Apelación: `disciplinary.appeal` o admin. No se filtra por nombre de rol. */
export function canResolveDisciplinaryAppeal(actor: DisciplinaryActor): boolean {
  return actorHasResolverPermission(actor, PERMISSIONS.DISCIPLINARY_APPEAL);
}

/** Recurso pendiente que el actor podría resolver con los POST de Sprint 4. */
export function canReviewPendingAppeal(
  actor: DisciplinaryActor,
  kind: AppealKind,
  outcome: AppealOutcome | null,
  responsibleUserId: number | null,
): boolean {
  if (outcome != null) return false;
  if (kind === AppealKind.REVOCATION) return canResolveDisciplinaryRevocation(actor, responsibleUserId);
  if (kind === AppealKind.APPEAL) return canResolveDisciplinaryAppeal(actor);
  return false;
}
