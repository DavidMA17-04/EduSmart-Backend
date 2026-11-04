import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { DisciplinaryAlertsController } from './disciplinary-alerts.controller';

describe('DisciplinaryAlertsController permissions', () => {
  const guard = new PermissionsGuard(new Reflector());
  const controller = new DisciplinaryAlertsController({} as never);

  it('el listado no exige un permiso único: el servicio aplica el alcance', () => {
    const context = {
      getHandler: () => controller.list,
      getClass: () => DisciplinaryAlertsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [], permissions: [] } }),
      }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
    expect(
      Object.getOwnPropertyNames(DisciplinaryAlertsController.prototype).filter((name) => name !== 'constructor'),
    ).toEqual(['list']);
  });
});
