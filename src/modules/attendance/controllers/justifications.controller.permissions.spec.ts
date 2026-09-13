import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { JustificationsController } from '../controllers/justifications.controller';

describe('PBI-27 JustificationsController permissions', () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);
  const controller = new JustificationsController({} as never);

  function ctxFor(handler: (...args: never[]) => unknown, permissions: string[]): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => JustificationsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [], permissions } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('create → attendance.justify', () => {
    expect(guard.canActivate(ctxFor(controller.create, [PERMISSIONS.ATTENDANCE_JUSTIFY]))).toBe(
      true,
    );
    expect(guard.canActivate(ctxFor(controller.create, [PERMISSIONS.ATTENDANCE_READ]))).toBe(false);
  });

  it('list → attendance.view', () => {
    expect(guard.canActivate(ctxFor(controller.list, [PERMISSIONS.ATTENDANCE_READ]))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.list, [PERMISSIONS.ATTENDANCE_JUSTIFY]))).toBe(
      false,
    );
  });

  it('review → attendance.review', () => {
    expect(guard.canActivate(ctxFor(controller.review, [PERMISSIONS.ATTENDANCE_REVIEW]))).toBe(
      true,
    );
    expect(guard.canActivate(ctxFor(controller.review, [PERMISSIONS.ATTENDANCE_EDIT]))).toBe(false);
  });

  it('uploadEvidence → attendance.justify', () => {
    expect(
      guard.canActivate(ctxFor(controller.uploadEvidence, [PERMISSIONS.ATTENDANCE_JUSTIFY])),
    ).toBe(true);
  });

  it('justifiable-absences → attendance.view', () => {
    expect(
      guard.canActivate(ctxFor(controller.listJustifiableAbsences, [PERMISSIONS.ATTENDANCE_READ])),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller.listJustifiableAbsences, [PERMISSIONS.ATTENDANCE_JUSTIFY]),
      ),
    ).toBe(false);
  });
});
