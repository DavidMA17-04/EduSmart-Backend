import { RoleEntity } from '../../roles/entities/role.entity';
import { User } from '../entities/user.entity';

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
  roles: Array<{ id: number; name: string; status: RoleEntity['status'] }>;
  createdAt: Date;
  updatedAt: Date;
}

function resolveFirstName(user: User): string | null {
  const name = user.name?.trim();
  return name ? name : null;
}

function resolveLastName(user: User): string | null {
  const fromParts = [user.first_lastname, user.second_lastname]
    .filter(Boolean)
    .join(' ')
    .trim();
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
  const fallback = [user.first_lastname, user.second_lastname]
    .filter(Boolean)
    .join(' ')
    .trim();
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
    roles: (user.roles ?? []).map((role) => ({
      id: role.id,
      name: role.name,
      status: role.status,
    })),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
