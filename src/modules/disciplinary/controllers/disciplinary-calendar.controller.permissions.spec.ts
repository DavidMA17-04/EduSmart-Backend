import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { DisciplinaryCalendarController } from './disciplinary-calendar.controller';

describe('DisciplinaryCalendarController permissions', () => {
  const guard = new PermissionsGuard(new Reflector());
  const controller = new DisciplinaryCalendarController({} as never);

  function ctxFor(handler: (...args: never[]) => unknown, permissions: string[]): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => DisciplinaryCalendarController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [], permissions } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('el calendario y los umbrales exigen disciplinary.configure', () => {
    for (const handler of [
      controller.listDays,
      controller.createDay,
      controller.deleteDay,
      controller.getSettings,
      controller.updateSettings,
    ]) {
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_CONFIGURE]))).toBe(true);
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_READ]))).toBe(false);
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_RESOLVE]))).toBe(false);
    }
  });
});
