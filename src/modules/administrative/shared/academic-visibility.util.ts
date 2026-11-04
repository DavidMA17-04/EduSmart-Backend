import {
  INSTITUTIONAL_ROLE_ADMIN,
  INSTITUTIONAL_ROLE_DIRECTOR,
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

export function actorHasDirectorRole(roles: readonly string[]): boolean {
  return roles.some((role) => roleMatches(role, INSTITUTIONAL_ROLE_DIRECTOR, 'Director'));
}

export function actorHasTeacherRole(roles: readonly string[]): boolean {
  return roles.some((role) =>
    roleMatches(role, INSTITUTIONAL_ROLE_TEACHER, Role.TEACHER, 'Docente', 'TEACHER'),
  );
}

/** Only Administrador and Director see previous academic years/cycles. */
export function actorSeesFullAcademicHistory(roles: readonly string[]): boolean {
  return actorHasAdminRole(roles) || actorHasDirectorRole(roles);
}
