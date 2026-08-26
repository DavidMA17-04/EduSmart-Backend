import { RoleEntity } from '../../roles/entities/role.entity';
import { User } from '../entities/user.entity';

export interface UserPublicView {
  id: number;
  id_users?: number;
  name: string | null;
  nationalId: string | null;
  national_id?: string | null;
  first_lastname: string | null;
  second_lastname: string | null;
  email: string | null;
  phone: string | null;
  status: User['status'];
  roles: Array<{ id: number; name: string; status: RoleEntity['status'] }>;
  createdAt: Date;
  updatedAt: Date;
}

export function displayUserName(user: User): string {
  if (user.name && user.name.trim().length > 0) {
    return user.name.trim();
  }
  const composed = [
    user.firstName,
    user.lastName || [user.first_lastname, user.second_lastname].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  return composed || user.email || '';
}

export function toUserPublicView(user: User): UserPublicView {
  return {
    id: user.id,
    id_users: user.id,
    name: displayUserName(user),
    nationalId: user.nationalId ?? user.national_id ?? null,
    national_id: user.national_id ?? user.nationalId ?? null,
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
