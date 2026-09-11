import {
  INSTITUTIONAL_ROLE_ADMIN,
  INSTITUTIONAL_ROLE_STUDENT,
  INSTITUTIONAL_ROLE_TEACHER,
} from '../../../common/constants/institutional-roles.constant';
import { Role } from '../../../common/enums/role.enum';

export type MyScheduleActorKind = 'teacher' | 'student' | 'unsupported';

function roleMatches(
  role: string,
  ...candidates: string[]
): boolean {
  const value = String(role).trim();
  const lower = value.toLowerCase();
  return candidates.some((c) => c === value || c.toLowerCase() === lower);
}

export function actorHasTeacherRole(roles: readonly string[]): boolean {
  return roles.some((role) =>
    roleMatches(
      role,
      INSTITUTIONAL_ROLE_TEACHER,
      Role.TEACHER,
      'Docente',
      'TEACHER',
    ),
  );
}

export function actorHasStudentRole(roles: readonly string[]): boolean {
  return roles.some((role) =>
    roleMatches(
      role,
      INSTITUTIONAL_ROLE_STUDENT,
      Role.STUDENT,
      'Estudiante',
      'STUDENT',
    ),
  );
}

export function actorHasAdminRole(roles: readonly string[]): boolean {
  return roles.some((role) =>
    roleMatches(
      role,
      INSTITUTIONAL_ROLE_ADMIN,
      Role.ADMIN,
      'Administrador',
      'ADMIN',
    ),
  );
}

/**
 * E1 policy:
 * - Docente (or Admin calling my-schedule) → teacher scope (TA.userId)
 * - Docente + Estudiante → Docente wins
 * - Estudiante only → student scope (GroupEnrollment → group)
 * - otherwise → unsupported (empty entries, never global list)
 */
export function resolveMyScheduleActorKind(
  roles: readonly string[],
): MyScheduleActorKind {
  if (actorHasTeacherRole(roles) || actorHasAdminRole(roles)) {
    return 'teacher';
  }
  if (actorHasStudentRole(roles)) {
    return 'student';
  }
  return 'unsupported';
}
