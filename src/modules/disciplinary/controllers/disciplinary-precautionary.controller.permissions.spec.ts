import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { DisciplinaryPrecautionaryController } from './disciplinary-precautionary.controller';

describe('DisciplinaryPrecautionaryController permissions', () => {
  const guard = new PermissionsGuard(new Reflector());
  const controller = new DisciplinaryPrecautionaryController({} as never);

  function ctxFor(permissions: string[]): ExecutionContext {
    return {
      getHandler: () => controller.order,
      getClass: () => DisciplinaryPrecautionaryController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [], permissions } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('ordenar el retiro exige disciplinary.precautionary', () => {
    expect(guard.canActivate(ctxFor([PERMISSIONS.DISCIPLINARY_PRECAUTIONARY]))).toBe(true);
    expect(guard.canActivate(ctxFor([PERMISSIONS.DISCIPLINARY_RESOLVE]))).toBe(false);
    expect(guard.canActivate(ctxFor([]))).toBe(false);
  });
});
