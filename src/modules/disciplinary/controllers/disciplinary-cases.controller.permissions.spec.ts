import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { DisciplinaryCasesController } from './disciplinary-cases.controller';
import { DisciplinaryEvidenceController } from './disciplinary-evidence.controller';

const CASE_HANDLERS = [
  'searchStudents',
  'list',
  'findOne',
  'history',
  'startInvestigation',
  'observe',
  'requestInformation',
  'createFollowUp',
  'closeFollowUp',
  'archive',
  'annul',
  'communicate',
  'resolve',
  'requestCounsel',
  'issueCounsel',
  'respondInformation',
  'create',
] as const;

describe('DisciplinaryCasesController permissions', () => {
  const guard = new PermissionsGuard(new Reflector());
  const controller = new DisciplinaryCasesController({} as never, {} as never, {} as never);

  function ctxFor(handler: (...args: never[]) => unknown, permissions: string[]): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => DisciplinaryCasesController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [], permissions } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('buscar estudiantes y registrar exigen disciplinary.create', () => {
    for (const handler of [controller.searchStudents, controller.create]) {
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_CREATE]))).toBe(true);
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_READ]))).toBe(false);
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_VIEW_OWN]))).toBe(false);
    }
  });

  it('la bandeja y el detalle no exigen un solo permiso: view o view_own se resuelven en el servicio', () => {
    for (const handler of [controller.list, controller.findOne, controller.history]) {
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_VIEW_OWN]))).toBe(true);
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_READ]))).toBe(true);
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_CREATE]))).toBe(true);
    }
  });

  it('conducir la investigación no exige un permiso único: el servicio distingue guía, Dirección y administrador', () => {
    for (const handler of [
      controller.startInvestigation,
      controller.observe,
      controller.requestInformation,
      controller.respondInformation,
      controller.resolve,
      controller.communicate,
      controller.archive,
      controller.createFollowUp,
      controller.closeFollowUp,
    ]) {
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_RESOLVE]))).toBe(true);
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_READ]))).toBe(true);
      expect(guard.canActivate(ctxFor(handler, []))).toBe(true);
    }
  });

  it('anular exige disciplinary.configure', () => {
    expect(guard.canActivate(ctxFor(controller.annul, [PERMISSIONS.DISCIPLINARY_CONFIGURE]))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.annul, [PERMISSIONS.DISCIPLINARY_RESOLVE]))).toBe(false);
    expect(guard.canActivate(ctxFor(controller.annul, [PERMISSIONS.DISCIPLINARY_READ]))).toBe(false);
  });

  it('emitir el criterio exige disciplinary.review y solicitarlo no', () => {
    expect(guard.canActivate(ctxFor(controller.issueCounsel, [PERMISSIONS.DISCIPLINARY_REVIEW]))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.issueCounsel, [PERMISSIONS.DISCIPLINARY_READ]))).toBe(false);
    expect(guard.canActivate(ctxFor(controller.requestCounsel, [PERMISSIONS.DISCIPLINARY_RESOLVE]))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.requestCounsel, []))).toBe(true);
  });

  it('cada acción del controlador tiene una decisión de permiso', () => {
    const handlers = Object.getOwnPropertyNames(DisciplinaryCasesController.prototype).filter(
      (name) => name !== 'constructor',
    );
    expect(handlers.sort()).toEqual([...CASE_HANDLERS].sort());
  });

  it('subir una evidencia exige disciplinary.create y la descarga la resuelve el servicio', () => {
    const evidenceController = new DisciplinaryEvidenceController({} as never);
    const evidenceCtx = {
      getHandler: () => evidenceController.upload,
      getClass: () => DisciplinaryEvidenceController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [], permissions: [PERMISSIONS.DISCIPLINARY_CREATE] } }),
      }),
    } as unknown as ExecutionContext;
    const denied = {
      ...evidenceCtx,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [], permissions: [PERMISSIONS.DISCIPLINARY_READ] } }),
      }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(evidenceCtx)).toBe(true);
    expect(guard.canActivate(denied)).toBe(false);

    const downloadAllowed = {
      getHandler: () => evidenceController.download,
      getClass: () => DisciplinaryEvidenceController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [], permissions: [PERMISSIONS.DISCIPLINARY_VIEW_OWN] } }),
      }),
    } as unknown as ExecutionContext;
    const downloadEmpty = {
      getHandler: () => evidenceController.download,
      getClass: () => DisciplinaryEvidenceController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [], permissions: [] } }),
      }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(downloadAllowed)).toBe(true);
    expect(guard.canActivate(downloadEmpty)).toBe(true);
  });
});
