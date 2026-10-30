import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { PERMISSIONS_KEY } from '../../../../common/constants/metadata.constant';
import { UsersController } from './users.controller';
import { GuardianLinksController } from './guardian-links.controller';

describe('Guardian link permissions', () => {
  const reflector = new Reflector();

  it('GET exige administrator.view; alta y baja exigen administrator.edit (403 sin permiso)', () => {
    expect(reflector.get(PERMISSIONS_KEY, UsersController.prototype.listGuardianLinks)).toEqual([
      PERMISSIONS.ADMINISTRATOR_VIEW,
    ]);
    expect(reflector.get(PERMISSIONS_KEY, UsersController.prototype.createGuardianLink)).toEqual([
      PERMISSIONS.ADMINISTRATOR_EDIT,
    ]);
    expect(reflector.get(PERMISSIONS_KEY, GuardianLinksController.prototype.remove)).toEqual([
      PERMISSIONS.ADMINISTRATOR_EDIT,
    ]);
  });
});
