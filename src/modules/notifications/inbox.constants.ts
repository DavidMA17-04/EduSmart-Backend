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

/** Notificaciones disciplinarias de la casa Encargado. */
export const GUARDIAN_DISCIPLINARY_INBOX_HREF = '/guardian/discipline/notifications';

export function relocateAdminPath(pathname: string, prefix: string): string {
  if (prefix === '/admin') return pathname;
  if (pathname === '/admin') return prefix;
  if (pathname.startsWith('/admin/')) {
    return `${prefix}${pathname.slice('/admin'.length)}`;
  }
  return pathname;
}

/** SPA house prefix for staff inbox hrefs (Fase 2). */
export function spaHousePrefix(roles: readonly string[] | undefined): string {
  const names = (roles ?? []).map((role) => String(role).trim().toLowerCase());
  if (names.some((role) => role === 'administrador' || role === 'admin')) {
    return '/admin';
  }
  if (names.includes('director')) return '/director';
  if (names.some((role) => role === 'orientador' || role === 'counselor')) {
    return '/counselor';
  }
  if (names.some((role) => role === 'docente' || role === 'teacher')) {
    return '/teacher';
  }
  return '/admin';
}

export function inboxHrefFor(
  source: InboxSource,
  roles: readonly string[] | undefined,
): string {
  return relocateAdminPath(INBOX_HREF[source], spaHousePrefix(roles));
}

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
