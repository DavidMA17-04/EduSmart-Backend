import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AcademicPeriodsController } from './academic-periods/controllers/academic-periods.controller';
import { AcademicYearsController } from './academic-years/controllers/academic-years.controller';
import { GroupsController } from './sections/controllers/groups.controller';
import { SectionsController } from './sections/controllers/sections.controller';
import { SpecialtiesController } from './specialties/controllers/specialties.controller';

describe('Academic structure mutation permissions', () => {
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
        getRequest: () => ({ user: { roles: [], permissions } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('Docente con solo view no crea ni edita años, cursos, niveles ni especialidades', () => {
    const viewOnly = [
      PERMISSIONS.ACADEMIC_STRUCTURE_VIEW,
      PERMISSIONS.PERIODS_VIEW,
      PERMISSIONS.SECTIONS_VIEW,
      PERMISSIONS.SPECIALTIES_VIEW,
    ];
    const years = new AcademicYearsController({} as never);
    const periods = new AcademicPeriodsController({} as never);
    const sections = new SectionsController({} as never);
    const groups = new GroupsController({} as never);
    const specialties = new SpecialtiesController({} as never, {} as never);

    expect(guard.canActivate(ctxFor(years, years.create, viewOnly))).toBe(false);
    expect(guard.canActivate(ctxFor(periods, periods.create, viewOnly))).toBe(false);
    expect(guard.canActivate(ctxFor(periods, periods.activate, viewOnly))).toBe(false);
    expect(guard.canActivate(ctxFor(sections, sections.create, viewOnly))).toBe(false);
    expect(guard.canActivate(ctxFor(groups, groups.create, viewOnly))).toBe(false);
    expect(guard.canActivate(ctxFor(specialties, specialties.create, viewOnly))).toBe(false);
  });

  it('Configurar/crear/editar sí pasan con el permiso de mutación', () => {
    const years = new AcademicYearsController({} as never);
    const periods = new AcademicPeriodsController({} as never);
    const sections = new SectionsController({} as never);
    const groups = new GroupsController({} as never);
    const specialties = new SpecialtiesController({} as never, {} as never);

    expect(
      guard.canActivate(
        ctxFor(years, years.create, [PERMISSIONS.ACADEMIC_STRUCTURE_CONFIGURE]),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(ctxFor(periods, periods.create, [PERMISSIONS.PERIODS_CREATE])),
    ).toBe(true);
    expect(
      guard.canActivate(ctxFor(periods, periods.close, [PERMISSIONS.PERIODS_EDIT])),
    ).toBe(true);
    expect(
      guard.canActivate(ctxFor(sections, sections.update, [PERMISSIONS.SECTIONS_EDIT])),
    ).toBe(true);
    expect(
      guard.canActivate(ctxFor(groups, groups.remove, [PERMISSIONS.SECTIONS_EDIT])),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(specialties, specialties.uploadHubCover, [PERMISSIONS.SPECIALTIES_EDIT]),
      ),
    ).toBe(true);
  });
});
