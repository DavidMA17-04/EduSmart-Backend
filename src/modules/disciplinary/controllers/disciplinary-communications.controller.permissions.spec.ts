import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { DisciplinaryCommunicationsController } from './disciplinary-communications.controller';

const OPEN_HANDLERS = [
  'listMine',
  'confirmRead',
  'recordDelivery',
  'deliverFormalCharge',
  'downloadCommunicationPdf',
  'fileWrittenDefense',
] as const;

describe('DisciplinaryCommunicationsController permissions', () => {
  const guard = new PermissionsGuard(new Reflector());
  const controller = new DisciplinaryCommunicationsController({} as never, {} as never, {} as never);

  function ctxFor(handler: (...args: never[]) => unknown, permissions: string[]): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => DisciplinaryCommunicationsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles: [], permissions } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('cada acción tiene una decisión de permiso', () => {
    const handlers = Object.getOwnPropertyNames(DisciplinaryCommunicationsController.prototype).filter(
      (name) => name !== 'constructor',
    );
    expect(handlers.sort()).toEqual([...OPEN_HANDLERS, 'filePortalDefense'].sort());
  });

  it('la entrega, el PDF y el descargo escrito no exigen un permiso único', () => {
    for (const name of OPEN_HANDLERS) {
      const handler = controller[name] as (...args: never[]) => unknown;
      expect(guard.canActivate(ctxFor(handler, []))).toBe(true);
      expect(guard.canActivate(ctxFor(handler, ['disciplinary.view']))).toBe(true);
    }
  });

  it('el descargo del portal exige disciplinary.respond', () => {
    expect(guard.canActivate(ctxFor(controller.filePortalDefense, ['disciplinary.respond']))).toBe(true);
    expect(guard.canActivate(ctxFor(controller.filePortalDefense, ['disciplinary.view']))).toBe(false);
    expect(guard.canActivate(ctxFor(controller.filePortalDefense, []))).toBe(false);
  });
});
