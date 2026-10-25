import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { DisciplinaryAppealsController } from './disciplinary-appeals.controller';

const HANDLERS = [
  'fileRevocation',
  'fileAppeal',
  'resolveRevocation',
  'resolveAppeal',
  'list',
  'listEligible',
  'listReviewable',
  'getReviewable',
  'getTracking',
  'dashboard',
] as const;

describe('DisciplinaryAppealsController permissions', () => {
  const guard = new PermissionsGuard(new Reflector());
  const controller = new DisciplinaryAppealsController({} as never, {} as never);

  function ctxFor(handler: (...args: never[]) => unknown, permissions: string[]): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => DisciplinaryAppealsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [], permissions } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('interponer no exige un permiso único y resolver sí, según la instancia', () => {
    const handlers = Object.getOwnPropertyNames(DisciplinaryAppealsController.prototype).filter(
      (name) => name !== 'constructor',
    );
    expect(handlers.sort()).toEqual([...HANDLERS].sort());
    expect(guard.canActivate(ctxFor(controller.fileRevocation, []))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.fileAppeal, []))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.list, []))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.listEligible, []))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.listReviewable, []))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.getReviewable, []))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.getTracking, []))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.dashboard, [PERMISSIONS.DISCIPLINARY_READ]))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.dashboard, [PERMISSIONS.DISCIPLINARY_VIEW_OWN]))).toBe(false);
    expect(guard.canActivate(ctxFor(controller.resolveRevocation, [PERMISSIONS.DISCIPLINARY_RESOLVE]))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.resolveRevocation, [PERMISSIONS.DISCIPLINARY_APPEAL]))).toBe(false);
    expect(guard.canActivate(ctxFor(controller.resolveAppeal, [PERMISSIONS.DISCIPLINARY_APPEAL]))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.resolveAppeal, [PERMISSIONS.DISCIPLINARY_RESOLVE]))).toBe(false);
  });
});
