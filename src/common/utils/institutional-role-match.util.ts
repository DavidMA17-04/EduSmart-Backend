import {
  INSTITUTIONAL_ROLE_ADMIN,
  INSTITUTIONAL_ROLE_COUNSELOR,
  INSTITUTIONAL_ROLE_DIRECTOR,
  INSTITUTIONAL_ROLE_GUARDIAN,
  INSTITUTIONAL_ROLE_PARENT,
  INSTITUTIONAL_ROLE_STUDENT,
  INSTITUTIONAL_ROLE_TEACHER,
} from '../constants/institutional-roles.constant';
import { Role } from '../enums/role.enum';

function normalizeRole(value: string): string {
  return String(value).trim().toLowerCase();
}

/** Aliases accepted as the same institutional role (JWT vs enum). */
const ROLE_ALIASES: Record<string, readonly string[]> = {
  [Role.ADMIN]: [Role.ADMIN, INSTITUTIONAL_ROLE_ADMIN],
  [Role.TEACHER]: [Role.TEACHER, INSTITUTIONAL_ROLE_TEACHER],
  [Role.COUNSELOR]: [Role.COUNSELOR, INSTITUTIONAL_ROLE_COUNSELOR],
  [Role.STUDENT]: [Role.STUDENT, INSTITUTIONAL_ROLE_STUDENT],
  [Role.GUARDIAN]: [
    Role.GUARDIAN,
    INSTITUTIONAL_ROLE_GUARDIAN,
    INSTITUTIONAL_ROLE_PARENT,
  ],
  [INSTITUTIONAL_ROLE_DIRECTOR]: [INSTITUTIONAL_ROLE_DIRECTOR],
};

function aliasesFor(required: string): readonly string[] {
  const key = Object.keys(ROLE_ALIASES).find(
    (candidate) => normalizeRole(candidate) === normalizeRole(required),
  );
  return key ? ROLE_ALIASES[key] : [required];
}

export function institutionalRoleMatches(
  userRoles: readonly string[] | undefined,
  required: readonly string[],
): boolean {
  if (!required.length) return true;
  const held = new Set((userRoles ?? []).map(normalizeRole));
  return required.some((role) =>
    aliasesFor(role).some((alias) => held.has(normalizeRole(alias))),
  );
}
