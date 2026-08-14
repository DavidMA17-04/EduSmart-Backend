import { SetMetadata } from '@nestjs/common';
import { Permission } from '../constants/permissions.constant';
import { PERMISSIONS_KEY } from '../constants/metadata.constant';

export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
