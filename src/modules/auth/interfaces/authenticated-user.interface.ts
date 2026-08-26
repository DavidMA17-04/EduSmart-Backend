import { Role } from '../../../common/enums/role.enum';
import { Permission } from '../../../common/constants/permissions.constant';

export interface AuthenticatedUser {
  id: number;
  email: string;
  roles: Role[];
  permissions: Permission[];
}
