import {
  INSTITUTIONAL_ROLE_ADMIN,
  INSTITUTIONAL_ROLE_TEACHER,
} from '../../../common/constants/institutional-roles.constant';
import { Role } from '../../../common/enums/role.enum';

function roleMatches(role: string, ...candidates: string[]): boolean {
  const value = String(role).trim();
  const lower = value.toLowerCase();
  return candidates.some((c) => c === value || c.toLowerCase() === lower);
}

export function actorHasAdminRole(roles: readonly string[]): boolean {
  return roles.some((role) =>
    roleMatches(role, INSTITUTIONAL_ROLE_ADMIN, Role.ADMIN, 'Administrador', 'ADMIN'),
  );
}

export function actorHasTeacherRole(roles: readonly string[]): boolean {
  return roles.some((role) =>
    roleMatches(role, INSTITUTIONAL_ROLE_TEACHER, Role.TEACHER, 'Docente', 'TEACHER'),
  );
}

/** Admins (and non-teachers) see full history; pure teachers see only the active year. */
export function actorSeesFullAcademicHistory(roles: readonly string[]): boolean {
  if (actorHasAdminRole(roles)) return true;
  if (actorHasTeacherRole(roles)) return false;
  return true;
}
