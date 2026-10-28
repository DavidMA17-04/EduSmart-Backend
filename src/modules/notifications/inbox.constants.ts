export const INBOX_LIMIT = 20;

export enum InboxSource {
  DISCIPLINARY = 'disciplinary',
  ABSENTEEISM = 'absenteeism',
  JUSTIFICATION_PENDING = 'justification_pending',
}

export const INBOX_HREF: Record<InboxSource, string> = {
  [InboxSource.DISCIPLINARY]: '/admin/discipline/notifications',
  [InboxSource.ABSENTEEISM]: '/admin/attendance/alerts',
  [InboxSource.JUSTIFICATION_PENDING]: '/admin/attendance/justifications',
};

const DISCIPLINARY_KIND_LABELS: Record<string, string> = {
  DIRECT_REPRIMAND: 'Amonestación directa',
  FORMAL_CHARGE: 'Comunicación formal',
  RESOLUTION: 'Resolución',
  APPEAL_RESOLUTION: 'Resolución de recurso',
  PRECAUTIONARY: 'Retiro precautorio',
};

export function disciplinaryKindLabel(kind: string): string {
  return DISCIPLINARY_KIND_LABELS[kind] ?? kind;
}
