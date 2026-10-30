import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

class SampleController {
  @Roles(Role.STUDENT)
  redeem() {
    return 'ok';
  }

  createSession() {
    return 'ok';
  }
}

class AdminOnlyController {
  @Roles(Role.ADMIN)
  bootstrap() {
    return 'ok';
  }
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const controller = new SampleController();
  const adminController = new AdminOnlyController();

  function ctxFor(
    handler: (...args: never[]) => unknown,
    roles: string[],
    ControllerClass: new (...args: never[]) => unknown = SampleController,
  ): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => ControllerClass,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles } }),
      }),
    } as unknown as ExecutionContext;
  }

  it('JWT Estudiante pasa @Roles(STUDENT)', () => {
    expect(guard.canActivate(ctxFor(controller.redeem, ['Estudiante']))).toBe(
      true,
    );
  });

  it('JWT Docente no pasa @Roles(STUDENT)', () => {
    expect(guard.canActivate(ctxFor(controller.redeem, ['Docente']))).toBe(
      false,
    );
  });

  it('JWT ADMIN y Administrador equivalen', () => {
    expect(
      guard.canActivate(
        ctxFor(adminController.bootstrap, ['ADMIN'], AdminOnlyController),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        ctxFor(
          adminController.bootstrap,
          ['Administrador'],
          AdminOnlyController,
        ),
      ),
    ).toBe(true);
  });

  it('sin @Roles el handler de gestión sigue abierto', () => {
    expect(guard.canActivate(ctxFor(controller.createSession, []))).toBe(true);
    expect(
      guard.canActivate(ctxFor(controller.createSession, ['Docente'])),
    ).toBe(true);
  });
});
