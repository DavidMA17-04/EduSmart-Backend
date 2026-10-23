import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { DisciplinaryDashboardController } from './disciplinary-dashboard.controller';

describe('DisciplinaryDashboardController permissions', () => {
  const guard = new PermissionsGuard(new Reflector());
  const controller = new DisciplinaryDashboardController({} as never);

  it('el tablero no exige un permiso único: el servicio limita a Dirección, Orientación y docentes guía', () => {
    const context = {
      getHandler: () => controller.get,
      getClass: () => DisciplinaryDashboardController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [], permissions: [] } }),
      }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
    expect(
      Object.getOwnPropertyNames(DisciplinaryDashboardController.prototype).filter((name) => name !== 'constructor'),
    ).toEqual(['get']);
  });
});
