import { UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '../../../common/enums/user-status.enum';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const passwordHash = '$2b$10$abcdefghijklmnopqrstuv';
  const activeUser = {
    id: 1,
    email: 'admin@ctphojancha.ed.cr',
    national_id: '100000000',
    name: 'Admin',
    first_lastname: 'Sistema',
    second_lastname: null,
    status: UserStatus.ACTIVE,
    passwordHash,
    mustChangePassword: false,
    roles: [{ name: 'Administrador', permissions: [{ code: 'administrator.view' }] }],
  };

  let authRepository: {
    findByIdentifier: jest.Mock;
    findById: jest.Mock;
    touchLastLogin: jest.Mock;
    save: jest.Mock;
  };
  let tokenService: { issueSessionTokens: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let sessionsService: {
    revokeCurrent: jest.Mock;
    revokeAllForUser: jest.Mock;
    getActiveMatchingRefresh: jest.Mock;
  };
  let auditLogService: { record: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    authRepository = {
      findByIdentifier: jest.fn(),
      findById: jest.fn(),
      touchLastLogin: jest.fn().mockResolvedValue(undefined),
      save: jest.fn(async (user) => user),
    };
    tokenService = {
      issueSessionTokens: jest.fn().mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        session: { id: 99 },
      }),
    };
    configService = {
      getOrThrow: jest.fn((key: string) =>
        key === 'jwt.refreshExpiresIn' ? '7d' : '8h',
      ),
    };
    sessionsService = {
      revokeCurrent: jest.fn().mockResolvedValue({ message: 'Sesión cerrada.' }),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
      getActiveMatchingRefresh: jest.fn(),
    };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };

    service = new AuthService(
      authRepository as never,
      tokenService as never,
      configService as never,
      sessionsService as never,
      auditLogService as never,
    );

    jest.spyOn(service, 'comparePassword').mockImplementation(async (plain) => plain === 'Admin1234');
    jest.spyOn(service, 'hashPassword').mockResolvedValue('new-hash');
  });

  it('rejects pending accounts with a verification message', async () => {
    authRepository.findByIdentifier.mockResolvedValue({
      ...activeUser,
      status: UserStatus.PENDING,
    });

    await expect(
      service.login({ identifier: activeUser.email, password: 'Admin1234' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: expect.stringMatching(/pendiente de verificación/i),
        reason: 'ACCOUNT_PENDING',
      }),
    });
    expect(tokenService.issueSessionTokens).not.toHaveBeenCalled();
  });

  it('issues session tokens and records LOGIN_SUCCESS for active users', async () => {
    authRepository.findByIdentifier.mockResolvedValue({ ...activeUser });

    const result = await service.login({ identifier: activeUser.email, password: 'Admin1234' });

    expect(result.accessToken).toBe('access');
    expect(result.refreshToken).toBe('refresh');
    expect(result.user.email).toBe(activeUser.email);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'LOGIN_SUCCESS' }),
    );
  });

  it('changePassword requires the current password and revokes every session', async () => {
    authRepository.findById.mockResolvedValue({ ...activeUser });

    const result = await service.changePassword(
      { id: 1, email: activeUser.email, roles: [], permissions: [], mustChangePassword: false },
      { currentPassword: 'Admin1234', newPassword: 'NuevaClave99' },
    );

    expect(result.message).toMatch(/Contraseña actualizada/);
    expect(sessionsService.revokeAllForUser).toHaveBeenCalledWith(1);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PASSWORD_CHANGED' }),
    );
  });

  it('changePassword rejects an incorrect current password', async () => {
    authRepository.findById.mockResolvedValue({ ...activeUser });

    await expect(
      service.changePassword(
        { id: 1, email: activeUser.email, roles: [], permissions: [], mustChangePassword: false },
        { currentPassword: 'wrong-pass', newPassword: 'NuevaClave99' },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
