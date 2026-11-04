import { RoleEntity } from '../../roles/entities/role.entity';
import { User } from '../entities/user.entity';

export interface OwnEnrollmentView {
  groupId: number;
  groupName: string | null;
  sectionLabel: string | null;
  specialtyName: string | null;
  academicPeriodId: number;
  academicPeriodName: string | null;
  startsOn: string;
  status: string;
}

export interface UserPublicView {
  id: number;
  id_users?: number;
  name: string | null;
  nationalId: string | null;
  national_id?: string | null;
  firstName: string | null;
  lastName: string | null;
  first_lastname: string | null;
  second_lastname: string | null;
  email: string | null;
  phone: string | null;
  status: User['status'];
  mustChangePassword: boolean;
  roles: Array<{ id: number; name: string; status: RoleEntity['status'] }>;
  departmentId: number | null;
  department: { id: number; code: string; name: string } | null;
  enrollment?: OwnEnrollmentView | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Same rule as disciplinary section labels, kept local to avoid coupling. */
export function composeOwnSectionLabel(
  gradeLevel: number | null | undefined,
  groupName: string | null | undefined,
): string | null {
  const name = groupName?.trim() ?? '';
  if (!name) return null;
  if (gradeLevel == null) return name;
  if (name.includes('-')) return name;
  const prefix = `${gradeLevel}-`;
  if (name === String(gradeLevel) || name.startsWith(prefix)) return name;
  return `${prefix}${name}`;
}

function resolveFirstName(user: User): string | null {
  return user.name?.trim() || null;
}

function resolveLastName(user: User): string | null {
  const fromParts = [user.first_lastname, user.second_lastname].filter(Boolean).join(' ').trim();
  return fromParts || null;
}

export function displayUserName(user: User): string {
  if (user.name && user.name.trim().length > 0) {
    const composed = [user.name, user.first_lastname, user.second_lastname]
      .filter(Boolean)
      .join(' ')
      .trim();
    return composed || user.name.trim();
  }
  const fallback = [user.first_lastname, user.second_lastname].filter(Boolean).join(' ').trim();
  return fallback || user.email || '';
}

export function toUserPublicView(user: User): UserPublicView {
  return {
    id: user.id,
    id_users: user.id,
    name: user.name ?? null,
    nationalId: user.nationalId ?? user.national_id ?? null,
    national_id: user.national_id ?? user.nationalId ?? null,
    firstName: resolveFirstName(user),
    lastName: resolveLastName(user),
    first_lastname: user.first_lastname ?? null,
    second_lastname: user.second_lastname ?? null,
    email: user.email ?? null,
    phone: user.phone ?? null,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    roles: (user.roles ?? []).map((role) => ({
      id: role.id,
      name: role.name,
      status: role.status,
    })),
    departmentId: user.teacherProfile?.departmentId ?? null,
    department: user.teacherProfile?.department
      ? {
          id: user.teacherProfile.department.id,
          code: user.teacherProfile.department.code,
          name: user.teacherProfile.department.name,
        }
      : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
