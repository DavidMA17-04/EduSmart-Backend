import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { Role } from '../../../common/enums/role.enum';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

function roleMatches(role: string, ...candidates: string[]): boolean {
  const value = String(role).trim().toLowerCase();
  return candidates.some((c) => value === c.toLowerCase());
}

export function isStudentActor(actor: AuthenticatedUser): boolean {
  return (actor.roles ?? []).some((role) =>
    roleMatches(String(role), Role.STUDENT, 'Estudiante'),
  );
}

/** Solo el Administrador revisa justificaciones de toda la institución. */
export function isInstitutionWideReviewer(actor: AuthenticatedUser): boolean {
  return (actor.roles ?? []).some((role) =>
    roleMatches(String(role), Role.ADMIN, 'Administrador'),
  );
}

export function hasAttendanceHistoryAccess(actor: AuthenticatedUser): boolean {
  if ((actor.roles ?? []).includes(Role.ADMIN)) return true;
  const permissions = actor.permissions ?? [];
  return (
    permissions.includes(PERMISSIONS.ATTENDANCE_READ) ||
    permissions.includes(PERMISSIONS.ATTENDANCE_VIEW_OWN) ||
    isStudentActor(actor)
  );
}

export function isOwnHistoryOnlyActor(actor: AuthenticatedUser): boolean {
  if ((actor.roles ?? []).includes(Role.ADMIN)) return false;
  if ((actor.permissions ?? []).includes(PERMISSIONS.ATTENDANCE_READ)) {
    return false;
  }
  return (
    (actor.permissions ?? []).includes(PERMISSIONS.ATTENDANCE_VIEW_OWN) ||
    isStudentActor(actor)
  );
}
