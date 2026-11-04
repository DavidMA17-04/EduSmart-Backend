import { AppealKind, AppealOutcome, DisciplinaryCaseStatus, DisciplinaryTrack, ResolutionOutcome } from '../constants/disciplinary.enums';
import { addBusinessDays } from '../utils/business-days';

export const NO_DEFENSE_NOTE = 'Sin descargo';
export const FIRM_NOTE = 'Plazo de recursos vencido';
export const SUBSIDIARY_ELEVATED_EVENT = 'SUBSIDIARY_ELEVATED';
export const APPEAL_RESOLUTION_BUSINESS_DAYS = 8;
export const RESOLUTION_BUSINESS_DAYS = 5;

export interface DeadlineAppealFact {
  kind: AppealKind;
  isSubsidiary: boolean;
  outcome: AppealOutcome | null;
  resolvedOn: string | null;
}

export interface DeadlineSnapshot {
  track: DisciplinaryTrack;
  status: DisciplinaryCaseStatus;
  stepStartedOn: string;
  stepBusinessDays: number;
  resolutionOutcome: ResolutionOutcome | null;
  defenseFiled: boolean;
  appealOpen: boolean;
  subsidiaryAwaitingElevation: boolean;
  revocationRejectedOn: string | null;
}

export type DeadlinePlan =
  | {
      type: 'TRANSITION';
      to: DisciplinaryCaseStatus;
      effectiveOn: string;
      note: string;
      stepStartedOn?: string;
      stepBusinessDays?: number;
      firm: boolean;
    }
  | {
      type: 'ELEVATE_SUBSIDIARY';
      effectiveOn: string;
      businessDays: number;
    };

export function isSubsidiaryAwaitingElevation(
  appeals: readonly DeadlineAppealFact[],
  alreadyElevated: boolean,
): { pending: boolean; rejectedOn: string | null } {
  if (alreadyElevated) return { pending: false, rejectedOn: null };
  const rejected = appeals.find(
    (appeal) =>
      appeal.kind === AppealKind.REVOCATION &&
      appeal.isSubsidiary &&
      appeal.outcome === AppealOutcome.UPHOLD &&
      appeal.resolvedOn,
  );
  const appealAlreadyOpen = appeals.some(
    (appeal) => appeal.kind === AppealKind.APPEAL && appeal.outcome == null,
  );
  if (!rejected || appealAlreadyOpen) return { pending: false, rejectedOn: null };
  return { pending: true, rejectedOn: rejected.resolvedOn };
}

function dueOn(snapshot: DeadlineSnapshot, nonWorkingDays: ReadonlySet<string>): string | null {
  if (snapshot.stepBusinessDays <= 0) return null;
  return addBusinessDays(snapshot.stepStartedOn, snapshot.stepBusinessDays, nonWorkingDays);
}

function firmTarget(snapshot: DeadlineSnapshot): DisciplinaryCaseStatus {
  if (
    snapshot.track === DisciplinaryTrack.DUE_PROCESS &&
    snapshot.resolutionOutcome === ResolutionOutcome.DISMISS
  ) {
    return DisciplinaryCaseStatus.DISMISSED;
  }
  return DisciplinaryCaseStatus.FIRM;
}

/**
 * Siguiente efecto de plazo, o null si no hay nada que hacer.
 * `today` es la fecha institucional YYYY-MM-DD. El efecto se fecha en el vencimiento, no en `today`.
 */
export function planDeadline(
  snapshot: DeadlineSnapshot,
  today: string,
  nonWorkingDays: ReadonlySet<string> = new Set(),
): DeadlinePlan | null {
  if (
    snapshot.status === DisciplinaryCaseStatus.IN_APPEAL &&
    snapshot.subsidiaryAwaitingElevation &&
    snapshot.revocationRejectedOn
  ) {
    return {
      type: 'ELEVATE_SUBSIDIARY',
      effectiveOn: snapshot.revocationRejectedOn,
      businessDays: APPEAL_RESOLUTION_BUSINESS_DAYS,
    };
  }

  const due = dueOn(snapshot, nonWorkingDays);
  if (!due || today <= due) return null;

  if (snapshot.status === DisciplinaryCaseStatus.COMMUNICATED && !snapshot.defenseFiled) {
    return {
      type: 'TRANSITION',
      to: DisciplinaryCaseStatus.PENDING_RESOLUTION,
      effectiveOn: due,
      note: NO_DEFENSE_NOTE,
      stepStartedOn: due,
      stepBusinessDays: RESOLUTION_BUSINESS_DAYS,
      firm: false,
    };
  }

  const waitingToBecomeFirm =
    !snapshot.appealOpen &&
    (snapshot.status === DisciplinaryCaseStatus.RESOLVED ||
      snapshot.status === DisciplinaryCaseStatus.NOTIFIED ||
      snapshot.status === DisciplinaryCaseStatus.IN_APPEAL);

  if (!waitingToBecomeFirm) return null;

  const to = firmTarget(snapshot);
  return {
    type: 'TRANSITION',
    to,
    effectiveOn: due,
    note: FIRM_NOTE,
    firm: to === DisciplinaryCaseStatus.FIRM,
  };
}
