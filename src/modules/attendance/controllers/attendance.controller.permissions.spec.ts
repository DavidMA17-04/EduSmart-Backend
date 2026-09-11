import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { AttendanceController } from '../controllers/attendance.controller';

describe('Phase 1A.1 AttendanceController permissions', () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);
  const controller = new AttendanceController({} as never, {} as never);

  function ctxFor(
    handler: (...args: never[]) => unknown,
    permissions: string[],
  ): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => AttendanceController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [], permissions } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('1. available-offerings → attendance.view', () => {
    expect(
      guard.canActivate(
        ctxFor(controller.listAvailableOfferings, [PERMISSIONS.ATTENDANCE_READ]),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller.listAvailableOfferings, [
          PERMISSIONS.ATTENDANCE_REGISTER,
        ]),
      ),
    ).toBe(false);
  });

  it('2. create session → attendance.create', () => {
    expect(
      guard.canActivate(
        ctxFor(controller.createSession, [PERMISSIONS.ATTENDANCE_REGISTER]),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller.createSession, [PERMISSIONS.ATTENDANCE_READ]),
      ),
    ).toBe(false);
  });

  it('F. from-schedule → attendance.create', () => {
    expect(
      guard.canActivate(
        ctxFor(controller.createSessionFromSchedule, [
          PERMISSIONS.ATTENDANCE_REGISTER,
        ]),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller.createSessionFromSchedule, [PERMISSIONS.ATTENDANCE_READ]),
      ),
    ).toBe(false);
  });

  it('F. schedule-context → attendance.view', () => {
    expect(
      guard.canActivate(
        ctxFor(controller.getScheduleContext, [PERMISSIONS.ATTENDANCE_READ]),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller.getScheduleContext, [
          PERMISSIONS.ATTENDANCE_REGISTER,
        ]),
      ),
    ).toBe(false);
  });

  it('3. roster → attendance.view', () => {
    expect(
      guard.canActivate(
        ctxFor(controller.getRoster, [PERMISSIONS.ATTENDANCE_READ]),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller.getRoster, [PERMISSIONS.ATTENDANCE_EDIT]),
      ),
    ).toBe(false);
  });

  it('4. records → attendance.edit', () => {
    expect(
      guard.canActivate(
        ctxFor(controller.upsertRecords, [PERMISSIONS.ATTENDANCE_EDIT]),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller.upsertRecords, [PERMISSIONS.ATTENDANCE_REGISTER]),
      ),
    ).toBe(false);
  });

  it('5. close → attendance.edit', () => {
    expect(
      guard.canActivate(
        ctxFor(controller.closeSession, [PERMISSIONS.ATTENDANCE_EDIT]),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller.closeSession, [PERMISSIONS.ATTENDANCE_REGISTER]),
      ),
    ).toBe(false);
  });

  it('Phase 1A.2 listAttendanceGroups → attendance.view', () => {
    expect(
      guard.canActivate(
        ctxFor(controller.listAttendanceGroups, [PERMISSIONS.ATTENDANCE_READ]),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller.listAttendanceGroups, [
          PERMISSIONS.ATTENDANCE_REGISTER,
        ]),
      ),
    ).toBe(false);
  });

  it('Phase 1A.2 getSessionDetail → attendance.view', () => {
    expect(
      guard.canActivate(
        ctxFor(controller.getSessionDetail, [PERMISSIONS.ATTENDANCE_READ]),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller.getSessionDetail, [PERMISSIONS.ATTENDANCE_EDIT]),
      ),
    ).toBe(false);
  });
});
