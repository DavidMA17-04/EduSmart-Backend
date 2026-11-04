import { AppealKind, AppealOutcome, CommunicationKind, DisciplinaryCaseStatus } from '../constants/disciplinary.enums';
import { InfractionSeverity } from '../constants/infraction-severity.constant';
import { DeductionState, deductionOf } from './conduct-grade';

export const APPEAL_TIMELINE_KINDS = [
  'REVOCATION_FILED',
  'REVOCATION_RESOLVED',
  'SUBSIDIARY_ELEVATED',
  'APPEAL_FILED',
  'APPEAL_RESOLVED',
  'NOTIFIED',
  'READ',
] as const;

export type AppealTimelineKind = (typeof APPEAL_TIMELINE_KINDS)[number];

export interface AppealTimelineEntry {
  kind: AppealTimelineKind;
  title: string;
  occurredAt: string;
  statusLabel: string;
  note: string | null;
}

export interface AppealTimelineEventInput {
  type: string;
  createdAt: unknown;
  fromStatus?: string | null;
  toStatus?: string | null;
  payload?: Record<string, unknown> | null;
}

export interface AppealTimelineAppealInput {
  kind: AppealKind;
  isSubsidiary: boolean;
  filedAt: unknown;
  resolvedAt: unknown;
  outcome: AppealOutcome | null;
}

export interface AppealTimelineCommunicationInput {
  kind: string;
  issuedAt: unknown;
}

export interface AppealTimelineNotificationInput {
  readAt: unknown;
}

const TITLES: Record<AppealTimelineKind, string> = {
  REVOCATION_FILED: 'Presentación de revocatoria',
  REVOCATION_RESOLVED: 'Resolución de revocatoria',
  SUBSIDIARY_ELEVATED: 'Elevación de apelación subsidiaria',
  APPEAL_FILED: 'Presentación de apelación',
  APPEAL_RESOLVED: 'Resolución de apelación',
  NOTIFIED: 'Notificación de la resolución',
  READ: 'Lectura confirmada',
};

const STATUS_LABELS: Record<AppealTimelineKind, string> = {
  REVOCATION_FILED: 'Presentado',
  REVOCATION_RESOLVED: 'Resuelto',
  SUBSIDIARY_ELEVATED: 'Elevado',
  APPEAL_FILED: 'Presentado',
  APPEAL_RESOLVED: 'Resuelto',
  NOTIFIED: 'Notificado',
  READ: 'Leído',
};

const SPECIFIC_EVENT_TYPES = new Set<string>([
  'REVOCATION_FILED',
  'REVOCATION_RESOLVED',
  'APPEAL_FILED',
  'SUBSIDIARY_ELEVATED',
]);

export function appealDeduction(
  status: DisciplinaryCaseStatus,
  severity: InfractionSeverity,
): { state: DeductionState; points: number; label: string } {
  return deductionOf(status, severity);
}

export function buildAppealTimeline(input: {
  events?: readonly AppealTimelineEventInput[];
  appeals?: readonly AppealTimelineAppealInput[];
  communications?: readonly AppealTimelineCommunicationInput[];
  notifications?: readonly AppealTimelineNotificationInput[];
}): AppealTimelineEntry[] {
  const entries: AppealTimelineEntry[] = [];
  const seen = new Set<string>();

  const add = (kind: AppealTimelineKind, at: unknown, note: string | null = null) => {
    const occurredAt = asIsoDateTime(at);
    if (!occurredAt) return;
    const unique = kind === 'NOTIFIED' || kind === 'READ' ? `${kind}:${occurredAt}` : kind;
    if (seen.has(unique)) return;
    seen.add(unique);
    entries.push({
      kind,
      title: TITLES[kind],
      occurredAt,
      statusLabel: STATUS_LABELS[kind],
      note,
    });
  };

  for (const event of input.events ?? []) {
    if (!SPECIFIC_EVENT_TYPES.has(event.type)) continue;
    add(event.type as AppealTimelineKind, event.createdAt, noteOf(event.payload));
  }

  for (const appeal of input.appeals ?? []) {
    if (appeal.kind === AppealKind.REVOCATION) {
      add('REVOCATION_FILED', appeal.filedAt);
      if (appeal.outcome) add('REVOCATION_RESOLVED', appeal.resolvedAt);
    }
    if (appeal.kind === AppealKind.APPEAL) {
      if (appeal.isSubsidiary) add('SUBSIDIARY_ELEVATED', appeal.filedAt);
      else add('APPEAL_FILED', appeal.filedAt);
      if (appeal.outcome) add('APPEAL_RESOLVED', appeal.resolvedAt);
    }
  }

  for (const communication of input.communications ?? []) {
    if (communication.kind === CommunicationKind.APPEAL_RESOLUTION) {
      add('NOTIFIED', communication.issuedAt);
    }
  }

  for (const notification of input.notifications ?? []) {
    add('READ', notification.readAt);
  }

  return entries.sort((left, right) => {
    const byDate = left.occurredAt.localeCompare(right.occurredAt);
    return byDate !== 0 ? byDate : left.kind.localeCompare(right.kind);
  });
}

function noteOf(payload: Record<string, unknown> | null | undefined): string | null {
  return typeof payload?.note === 'string' ? payload.note : null;
}

function asIsoDateTime(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
