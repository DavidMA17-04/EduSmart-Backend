import * as fs from 'fs';
import * as path from 'path';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { ScheduleEntriesController } from './schedule-entries.controller';
import { ScheduleMyScheduleController } from './schedule-my-schedule.controller';
import { ScheduleTimeSlotsController } from './schedule-time-slots.controller';

describe('Schedule controllers permissions (D1 my-schedule)', () => {
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

  it('1. my-schedule requiere schedules.view_own', () => {
    const controller = new ScheduleMyScheduleController({} as never);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.getMySchedule, [
          PERMISSIONS.SCHEDULES_VIEW_OWN,
        ]),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.getMySchedule, [
          PERMISSIONS.SCHEDULES_VIEW,
        ]),
      ),
    ).toBe(false);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.getMySchedule, [
          PERMISSIONS.ATTENDANCE_READ,
        ]),
      ),
    ).toBe(false);
  });

  it('11. GET entries sigue requiriendo schedules.view', () => {
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

  it('17–19. view_own NO autoriza POST/PUT/DELETE entries', () => {
    const controller = new ScheduleEntriesController({} as never);
    for (const handler of [
      controller.create,
      controller.update,
      controller.remove,
    ]) {
      expect(
        guard.canActivate(
          ctxFor(controller, handler, [PERMISSIONS.SCHEDULES_VIEW_OWN]),
        ),
      ).toBe(false);
      expect(
        guard.canActivate(
          ctxFor(controller, handler, [PERMISSIONS.SCHEDULES_EDIT]),
        ),
      ).toBe(true);
    }
  });

  it('20. view_own NO abre GET time-slots admin', () => {
    const controller = new ScheduleTimeSlotsController({} as never);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.list, [PERMISSIONS.SCHEDULES_VIEW_OWN]),
      ),
    ).toBe(false);
    expect(
      guard.canActivate(
        ctxFor(controller, controller.list, [PERMISSIONS.SCHEDULES_VIEW]),
      ),
    ).toBe(true);
  });

  it('my-schedule pasa actor.id al service (no query teacherId)', async () => {
    const getMySchedule = jest.fn().mockResolvedValue({
      timeSlots: [],
      entries: [],
    });
    const controller = new ScheduleMyScheduleController({
      getMySchedule,
    } as never);
    await controller.getMySchedule(
      { id: 522, email: 't@x', roles: [], permissions: [], mustChangePassword: false },
      { periodId: 1, dayOfWeek: 2 } as never,
    );
    expect(getMySchedule).toHaveBeenCalledWith(
      { id: 522, roles: [] },
      {
        periodId: 1,
        dayOfWeek: 2,
      },
    );
  });
});

describe('migration 015 static audit (D1.1 VIEW_OWN)', () => {
  const file = path.join(
    __dirname,
    '../../../database/migrations/015_schedule_view_own_permission.sql',
  );
  const sql = fs.readFileSync(file, 'utf8');
  const executable = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  it('ALTER action enum preserva valores previos e incluye VIEW_OWN', () => {
    expect(executable).toMatch(/ALTER\s+TABLE\s+`permissions`/i);
    expect(executable).toMatch(/MODIFY\s+COLUMN\s+`action`\s+ENUM/i);
    for (const value of [
      'VIEW',
      'CREATE',
      'EDIT',
      'DELETE',
      'EXPORT',
      'CONFIGURE',
      'VIEW_OWN',
    ]) {
      expect(executable).toContain(`'${value}'`);
    }
    expect(executable).not.toMatch(/MODIFY\s+COLUMN\s+`module`/i);
  });

  it('permission code / module / action VIEW_OWN / Docente / NOT EXISTS', () => {
    expect(sql).toContain("'schedules.view_own'");
    expect(sql).toContain("'SCHEDULES'");
    expect(sql).toContain("'VIEW_OWN'");
    expect(sql).toContain("'Ver el propio horario'");
    expect(sql).toContain("r.`name` = 'Docente'");
    expect(sql).toMatch(/NOT EXISTS/i);
    expect(sql).not.toMatch(/id_roles\s*=\s*\d/);
    expect(sql).not.toMatch(/id_permissions\s*=\s*\d/);
  });

  it('insert usa action VIEW_OWN; no grant view/edit; no Estudiante', () => {
    expect(executable).toMatch(
      /SELECT\s+'schedules\.view_own',\s*'SCHEDULES',\s*'VIEW_OWN'/i,
    );
    expect(executable).not.toMatch(
      /SELECT\s+'schedules\.view_own',\s*'SCHEDULES',\s*'VIEW'/i,
    );
    expect(executable).not.toMatch(/p\.`code`\s*=\s*'schedules\.view'/);
    expect(executable).not.toContain("'schedules.edit'");
    expect(executable).not.toContain('Estudiante');
    expect(sql).not.toMatch(/014_schedule/);
  });
});

describe('migration 016 static audit (E1 Estudiante view_own grant)', () => {
  const file = path.join(
    __dirname,
    '../../../database/migrations/016_schedule_student_view_own_permission.sql',
  );
  const sql = fs.readFileSync(file, 'utf8');
  const executable = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  it('grant schedules.view_own a Estudiante; NOT EXISTS; IDs por SELECT', () => {
    expect(sql).toContain("'schedules.view_own'");
    expect(sql).toContain("r.`name` = 'Estudiante'");
    expect(sql).toMatch(/NOT EXISTS/i);
    expect(sql).not.toMatch(/id_roles\s*=\s*\d/);
    expect(sql).not.toMatch(/id_permissions\s*=\s*\d/);
  });

  it('no INSERT permission; no ALTER; no Docente/Admin/view/edit grants', () => {
    expect(executable).not.toMatch(/INSERT\s+INTO\s+`permissions`/i);
    expect(executable).not.toMatch(/ALTER\s+TABLE/i);
    expect(executable).not.toContain('Docente');
    expect(executable).not.toContain('Administrador');
    expect(executable).not.toContain("'schedules.view'");
    expect(executable).not.toContain("'schedules.edit'");
  });
});
