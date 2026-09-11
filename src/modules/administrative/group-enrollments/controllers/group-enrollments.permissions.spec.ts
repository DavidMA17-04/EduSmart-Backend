import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../../../../common/constants/permissions.constant';
import { Role } from '../../../../common/enums/role.enum';
import { PermissionsGuard } from '../../../../common/guards/permissions.guard';
import { GroupEnrollmentsController } from '../controllers/group-enrollments.controller';
import { SubjectsController } from '../../subjects/controllers/subjects.controller';
import { TeachingAssignmentsController } from '../../teaching-assignments/controllers/teaching-assignments.controller';

describe('Phase 0.1 controller permissions metadata', () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);

  function ctxFor(
    controller: object,
    handler: (...args: never[]) => unknown,
    user: { roles?: Role[]; permissions?: string[] },
  ): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => controller.constructor,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('Subjects GET requires academic_structure.view', () => {
    const controller = new SubjectsController({} as never);
    const allowed = guard.canActivate(
      ctxFor(controller, controller.findAll, {
        roles: [],
        permissions: [PERMISSIONS.ACADEMIC_STRUCTURE_VIEW],
      }),
    );
    const denied = guard.canActivate(
      ctxFor(controller, controller.findAll, {
        roles: [],
        permissions: [PERMISSIONS.STUDENTS_READ],
      }),
    );
    expect(allowed).toBe(true);
    expect(denied).toBe(false);
  });

  it('Subjects POST requires academic_structure.edit', () => {
    const controller = new SubjectsController({} as never);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.create, {
          permissions: [PERMISSIONS.ACADEMIC_STRUCTURE_EDIT],
        }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.create, {
          permissions: [PERMISSIONS.ACADEMIC_STRUCTURE_VIEW],
        }),
      ),
    ).toBe(false);
  });

  it('TeachingAssignments mutations require academic_structure.edit', () => {
    const controller = new TeachingAssignmentsController({} as never);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.create, {
          permissions: [PERMISSIONS.ACADEMIC_STRUCTURE_EDIT],
        }),
      ),
    ).toBe(true);
  });

  it('TeachingAssignments list requires academic_structure.view', () => {
    const controller = new TeachingAssignmentsController({} as never);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.list, {
          permissions: [PERMISSIONS.ACADEMIC_STRUCTURE_VIEW],
        }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.list, {
          permissions: [PERMISSIONS.ACADEMIC_STRUCTURE_EDIT],
        }),
      ),
    ).toBe(false);
  });

  it('GroupEnrollments create/transfer/as-of use students.*', () => {
    const controller = new GroupEnrollmentsController({} as never);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.create, {
          permissions: [PERMISSIONS.STUDENTS_CREATE],
        }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.transfer, {
          permissions: [PERMISSIONS.STUDENTS_UPDATE],
        }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.findAsOf, {
          permissions: [PERMISSIONS.STUDENTS_READ],
        }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.create, {
          permissions: [PERMISSIONS.STUDENTS_READ],
        }),
      ),
    ).toBe(false);
  });
});
