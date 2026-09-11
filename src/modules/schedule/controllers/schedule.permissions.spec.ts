import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { ScheduleEntriesController } from '../controllers/schedule-entries.controller';
import { ScheduleTimeSlotsController } from '../controllers/schedule-time-slots.controller';

describe('Schedule controllers permissions', () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);

  function ctxFor(
    controller: object,
    handler: (...args: never[]) => unknown,
    permissions: string[],
  ): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => controller.constructor,
      switchToHttp: () => ({
        getRequest: () => ({ user: { permissions } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('7. time-slots GET requires schedules.view', () => {
    const controller = new ScheduleTimeSlotsController({} as never);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.list, [PERMISSIONS.SCHEDULES_VIEW]),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.list, [PERMISSIONS.ATTENDANCE_READ]),
      ),
    ).toBe(false);
  });

  it('25. entries mutations require schedules.edit', () => {
    const controller = new ScheduleEntriesController({} as never);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.create, [PERMISSIONS.SCHEDULES_EDIT]),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.create, [PERMISSIONS.SCHEDULES_VIEW]),
      ),
    ).toBe(false);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.remove, [PERMISSIONS.SCHEDULES_EDIT]),
      ),
    ).toBe(true);
  });

  it('entries list requires schedules.view (not view_own)', () => {
    const controller = new ScheduleEntriesController({} as never);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.list, [PERMISSIONS.SCHEDULES_VIEW]),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.list, [PERMISSIONS.SCHEDULES_VIEW_OWN]),
      ),
    ).toBe(false);
  });
});
