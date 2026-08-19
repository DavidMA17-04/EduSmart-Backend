import { RoleEntity } from '../../roles/entities/role.entity';
import { User } from '../entities/user.entity';

export interface UserPublicView {
  id: string;
  name: string | null;
  nationalId: string | null;
  firstName: string | null;
  lastName: string | null;
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
    name: user.name ?? null,
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
