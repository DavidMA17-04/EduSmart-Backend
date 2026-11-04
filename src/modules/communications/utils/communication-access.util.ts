import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { institutionalRoleMatches } from '../../../common/utils/institutional-role-match.util';

/** Single criterion for managing other authors' communications (drafts, stats, reads). */
export function canManageCommunications(user: Pick<AuthenticatedUser, 'permissions' | 'roles'>): boolean {
  return (
    user.permissions.includes(PERMISSIONS.COMMUNICATIONS_MANAGE) ||
    institutionalRoleMatches(user.roles, ['ADMIN', 'Director'])
  );
}

export function canPublishCommunications(user: Pick<AuthenticatedUser, 'permissions' | 'roles'>): boolean {
  return (
    user.permissions.includes(PERMISSIONS.COMMUNICATIONS_PUBLISH) ||
    institutionalRoleMatches(user.roles, ['ADMIN'])
  );
}
