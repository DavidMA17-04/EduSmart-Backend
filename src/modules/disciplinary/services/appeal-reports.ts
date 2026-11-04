import { AppealKind, AppealOutcome, DisciplinaryCaseStatus } from '../constants/disciplinary.enums';
import { AppealOutcomeFilter } from '../dto/list-disciplinary-appeals-query.dto';
import { DeadlineIndicator } from './case-read';

export interface AppealDashboardItem {
  kind: AppealKind;
  isSubsidiary?: boolean;
  outcome: AppealOutcome | null;
  deadline: DeadlineIndicator;
  caseStatus: DisciplinaryCaseStatus;
}

export interface AppealDashboard {
  total: number;
  pending: number;
  resolved: number;
  onTime: number;
  dueSoon: number;
  overdue: number;
  byKind: { REVOCATION: number; APPEAL: number };
  byOutcome: { PENDING: number; UPHOLD: number; REVOKE: number; MODIFY: number };
  byCaseStatus: Partial<Record<DisciplinaryCaseStatus, number>>;
}

export function emptyAppealDashboard(): AppealDashboard {
  return {
    total: 0,
    pending: 0,
    resolved: 0,
    onTime: 0,
    dueSoon: 0,
    overdue: 0,
    byKind: { REVOCATION: 0, APPEAL: 0 },
    byOutcome: { PENDING: 0, UPHOLD: 0, REVOKE: 0, MODIFY: 0 },
    byCaseStatus: {},
  };
}

export function buildAppealDashboard(items: readonly AppealDashboardItem[]): AppealDashboard {
  const board = emptyAppealDashboard();
  board.total = items.length;
  for (const item of items) {
    if (item.kind === AppealKind.APPEAL) board.byKind.APPEAL += 1;
    else board.byKind.REVOCATION += 1;

    if (item.outcome == null) {
      board.pending += 1;
      board.byOutcome.PENDING += 1;
      if (item.deadline === DeadlineIndicator.ON_TIME) board.onTime += 1;
      if (item.deadline === DeadlineIndicator.DUE_SOON) board.dueSoon += 1;
      if (item.deadline === DeadlineIndicator.OVERDUE) board.overdue += 1;
    } else {
      board.resolved += 1;
      board.byOutcome[item.outcome] += 1;
    }

    board.byCaseStatus[item.caseStatus] = (board.byCaseStatus[item.caseStatus] ?? 0) + 1;
  }
  return board;
}

export function appealKindReportLabel(kind: AppealKind, isSubsidiary = false): string {
  if (kind === AppealKind.APPEAL) return isSubsidiary ? 'Apelación en subsidio' : 'Apelación';
  return isSubsidiary ? 'Revocatoria con apelación en subsidio' : 'Revocatoria';
}

export function appealOutcomeReportLabel(
  outcome: AppealOutcome | AppealOutcomeFilter | 'PENDING' | null | undefined,
): string {
  if (outcome === AppealOutcome.UPHOLD) return 'Rechaza';
  if (outcome === AppealOutcome.REVOKE) return 'Acoge';
  if (outcome === AppealOutcome.MODIFY) return 'Acoge parcialmente';
  return 'Pendiente';
}

export function appealDeadlineReportLabel(deadline?: DeadlineIndicator | null): string {
  if (deadline === DeadlineIndicator.ON_TIME) return 'En plazo';
  if (deadline === DeadlineIndicator.DUE_SOON) return 'Por vencer';
  if (deadline === DeadlineIndicator.OVERDUE) return 'Vencido';
  return 'Todos';
}
