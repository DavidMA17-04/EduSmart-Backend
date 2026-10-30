import { Reflector } from '@nestjs/core';
import { Role } from '../../../common/enums/role.enum';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { AttendanceRedeemController } from './attendance-redeem.controller';

describe('AttendanceRedeemController', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const tokens = { redeemToken: jest.fn() };
  const controller = new AttendanceRedeemController(tokens as never);

  const student = {
    id: 501,
    email: 's@test.com',
    roles: ['Estudiante'],
    permissions: [],
    mustChangePassword: false,
  };

  function ctxFor(roles: string[]) {
    return {
      getHandler: () => controller.redeem,
      getClass: () => AttendanceRedeemController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { roles } }),
      }),
    } as never;
  }

  beforeEach(() => {
    tokens.redeemToken.mockReset();
  });

  it('JWT Estudiante pasa @Roles(STUDENT) en POST redeem', () => {
    expect(guard.canActivate(ctxFor(['Estudiante']))).toBe(true);
    expect(guard.canActivate(ctxFor([Role.STUDENT]))).toBe(true);
  });

  it('JWT Docente, Encargado y Admin reciben 403 en el guarda', () => {
    expect(guard.canActivate(ctxFor(['Docente']))).toBe(false);
    expect(guard.canActivate(ctxFor(['Encargado']))).toBe(false);
    expect(guard.canActivate(ctxFor(['Administrador']))).toBe(false);
    expect(guard.canActivate(ctxFor([Role.ADMIN]))).toBe(false);
  });

  it('canjea con { code } y el actor del JWT; ignora studentUserId extra', async () => {
    tokens.redeemToken.mockResolvedValue({ studentUserId: 501 });
    const body = { code: 'ABCD1234', studentUserId: 999 };
    await controller.redeem(body as never, student as never);
    expect(tokens.redeemToken).toHaveBeenCalledWith(
      { code: 'ABCD1234' },
      student,
    );
    expect(tokens.redeemToken).not.toHaveBeenCalledWith(
      expect.objectContaining({ studentUserId: 999 }),
      expect.anything(),
    );
  });
});
