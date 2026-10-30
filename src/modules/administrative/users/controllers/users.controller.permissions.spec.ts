import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../../../../common/constants/metadata.constant';
import { UsersController } from './users.controller';

describe('UsersController own-profile permissions', () => {
  const reflector = new Reflector();

  it('GET /users/me no exige permisos de catálogo (cualquier rol autenticado)', () => {
    expect(reflector.get(PERMISSIONS_KEY, UsersController.prototype.me)).toBeUndefined();
  });

  it('PATCH /users/me no exige administrator.edit', () => {
    expect(reflector.get(PERMISSIONS_KEY, UsersController.prototype.updateMe)).toBeUndefined();
  });

  it('GET /users/me/guardian-links no exige administrator.view', () => {
    expect(
      reflector.get(PERMISSIONS_KEY, UsersController.prototype.listMyGuardianLinks),
    ).toBeUndefined();
  });
});
