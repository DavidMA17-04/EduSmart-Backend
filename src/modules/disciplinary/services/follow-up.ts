import { INSTITUTIONAL_ROLE_COUNSELOR } from '../../../common/constants/institutional-roles.constant';
import { DisciplinaryActor } from './disciplinary-access.policy';
import { canConductInvestigation } from './investigation';

export const FOLLOW_UP_EVENT = 'FOLLOW_UP';
export const FOLLOW_UP_OUTCOME_EVENT = 'FOLLOW_UP_OUTCOME';
export const FOLLOW_UP_REMINDER_EVENT = 'FOLLOW_UP_REMINDER';

export interface FollowUpReminderCandidate {
  id: number;
  caseId: number;
  reviewOn: string;
  responsibleUserId: number | null;
  authorUserId: number;
}

export function canRegisterFollowUp(actor: DisciplinaryActor, responsibleUserId: number | null): boolean {
  if (actor.roleNames.includes(INSTITUTIONAL_ROLE_COUNSELOR)) return true;
  return canConductInvestigation(actor, responsibleUserId);
}

export function pendingReminders(
  rows: readonly FollowUpReminderCandidate[],
  today: string,
  remindedFollowUpIds: ReadonlySet<number>,
): FollowUpReminderCandidate[] {
  return rows.filter((row) => row.reviewOn <= today && !remindedFollowUpIds.has(row.id));
}
