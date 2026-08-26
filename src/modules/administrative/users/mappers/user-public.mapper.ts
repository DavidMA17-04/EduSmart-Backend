import { RoleEntity } from '../../roles/entities/role.entity';
import { User } from '../entities/user.entity';

export interface UserPublicView {
  id: number;
  name: string | null;
  nationalId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: User['status'];
  roles: Array<{ id: number; name: string; status: RoleEntity['status'] }>;
  createdAt: Date;
  updatedAt: Date;
}

export function displayUserName(user: User): string {
  const composed = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return user.name?.trim() || composed || user.email;
}

export function toUserPublicView(user: User): UserPublicView {
  return {
    id: user.id,
    name: displayUserName(user),
    nationalId: user.nationalId ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
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
