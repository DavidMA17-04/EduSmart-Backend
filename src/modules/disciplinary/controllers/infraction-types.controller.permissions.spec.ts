import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { InfractionTypesController } from './infraction-types.controller';

describe('InfractionTypesController permissions', () => {
  const guard = new PermissionsGuard(new Reflector());
  const controller = new InfractionTypesController({} as never, {} as never);

  function ctxFor(handler: (...args: never[]) => unknown, permissions: string[]): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => InfractionTypesController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [], permissions } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('lecturas → disciplinary.view', () => {
    for (const handler of [controller.list, controller.findOne, controller.listSeverityRules]) {
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_READ]))).toBe(true);
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_CREATE]))).toBe(false);
    }
  });

  it('exportaciones PDF/Excel → disciplinary.export', () => {
    for (const handler of [controller.exportExcel, controller.exportPdf]) {
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_EXPORT]))).toBe(true);
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_READ]))).toBe(false);
    }
  });

  it('opciones para registrar → disciplinary.create', () => {
    expect(guard.canActivate(ctxFor(controller.listOptions, [PERMISSIONS.DISCIPLINARY_CREATE]))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.listOptions, [PERMISSIONS.DISCIPLINARY_READ]))).toBe(false);
  });

  it('escrituras → disciplinary.configure', () => {
    for (const handler of [controller.create, controller.update, controller.deactivate]) {
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_CONFIGURE]))).toBe(true);
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_READ]))).toBe(false);
    }
  });
});
