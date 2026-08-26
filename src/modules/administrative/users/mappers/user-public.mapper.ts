import { RoleEntity } from '../../roles/entities/role.entity';
import { User } from '../entities/user.entity';

export interface UserPublicView {
  id: string;
  id_users?: string;
  name: string | null;
  nationalId: string | null;
  first_lastname: string | null;
  second_lastname: string | null;
  email: string | null;
  phone: string | null;
  status: User['status'];
  roles: Array<{ id: string; name: string; status: RoleEntity['status'] }>;
  createdAt: Date;
  updatedAt: Date;
}

export function toUserPublicView(user: User): UserPublicView {
  return {
    id: user.id,
    id_users: user.id,
    name: user.name ?? null,
    nationalId: user.nationalId ?? null,
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
