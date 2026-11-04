import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '../../../common/constants/permissions.constant';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { DisciplinaryExportsController } from './disciplinary-exports.controller';

describe('DisciplinaryExportsController permissions', () => {
  const guard = new PermissionsGuard(new Reflector());
  const controller = new DisciplinaryExportsController({} as never);

  function ctxFor(handler: (...args: never[]) => unknown, permissions: string[]): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => DisciplinaryExportsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [], permissions } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('exportar listado, historial y expediente exige disciplinary.export', () => {
    const handlers = [
      controller.exportCasesExcel,
      controller.exportCasesPdf,
      controller.exportHistoryExcel,
      controller.exportHistoryPdf,
      controller.exportCasePdf,
      controller.exportAppealsExcel,
      controller.exportAppealsPdf,
    ];
    expect(
      Object.getOwnPropertyNames(DisciplinaryExportsController.prototype).filter((name) => name !== 'constructor').sort(),
    ).toEqual(handlers.map((handler) => handler.name).sort());
    for (const handler of handlers) {
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_EXPORT]))).toBe(true);
      expect(guard.canActivate(ctxFor(handler, [PERMISSIONS.DISCIPLINARY_READ]))).toBe(false);
      expect(guard.canActivate(ctxFor(handler, []))).toBe(false);
    }
  });
});
