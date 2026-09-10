import { UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '../../../common/enums/user-status.enum';
import { PASSWORD_RESET } from '../../../common/constants/auth-security.constant';
import { PasswordRecoveryService } from './password-recovery.service';

describe('PasswordRecoveryService', () => {
  const activeUser = {
    id: 7,
    email: 'active@ctphojancha.ed.cr',
    status: UserStatus.ACTIVE,
    passwordHash: 'old-hash',
    mustChangePassword: false,
  };

  let authRepository: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    save: jest.Mock;
  };
  let tokensRepository: {
    invalidateOpenForUser: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findActiveByHash: jest.Mock;
  };
  let tokenService: {
    generateResetToken: jest.Mock;
    hashToken: jest.Mock;
  };
  let mailService: { sendMail: jest.Mock };
  let sessionsService: { revokeAllForUser: jest.Mock };
  let auditLogService: { record: jest.Mock };
  let configService: { get: jest.Mock };
  let service: PasswordRecoveryService;

  beforeEach(() => {
    authRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(async (user) => user),
    };
    tokensRepository = {
      invalidateOpenForUser: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((data) => data),
      save: jest.fn(async (row) => row),
      findActiveByHash: jest.fn(),
    };
    tokenService = {
      generateResetToken: jest.fn().mockReturnValue('raw-reset-token'),
      hashToken: jest.fn().mockReturnValue('hashed-token'),
    };
    mailService = { sendMail: jest.fn().mockResolvedValue(undefined) };
    sessionsService = { revokeAllForUser: jest.fn().mockResolvedValue(undefined) };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    configService = {
      get: jest.fn((key: string) => (key === 'APP_PUBLIC_URL' ? 'http://localhost:5173' : undefined)),
    };

    service = new PasswordRecoveryService(
      authRepository as never,
      tokensRepository as never,
      tokenService as never,
      mailService as never,
      sessionsService as never,
      auditLogService as never,
      configService as never,
    );
  });

  it('forgotPassword always returns the generic message and emails only active users', async () => {
    authRepository.findByEmail.mockResolvedValue({ ...activeUser });

    const result = await service.forgotPassword({ email: 'active@ctphojancha.ed.cr' });

    expect(result.message).toBe(PASSWORD_RESET.GENERIC_MESSAGE);
    expect(tokensRepository.invalidateOpenForUser).toHaveBeenCalledWith(activeUser.id);
    expect(mailService.sendMail).toHaveBeenCalled();
    const mailArg = mailService.sendMail.mock.calls[0][0] as { text: string };
    expect(mailArg.text).toContain('raw-reset-token');
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PASSWORD_RESET_REQUESTED' }),
    );
  });

  it('forgotPassword does not reveal missing accounts', async () => {
    authRepository.findByEmail.mockResolvedValue(null);

    const result = await service.forgotPassword({ email: 'missing@ctphojancha.ed.cr' });

    expect(result.message).toBe(PASSWORD_RESET.GENERIC_MESSAGE);
    expect(mailService.sendMail).not.toHaveBeenCalled();
    expect(tokensRepository.save).not.toHaveBeenCalled();
  });

  it('resetPassword updates the hash, marks the token used and revokes sessions', async () => {
    tokensRepository.findActiveByHash.mockResolvedValue({
      id: 1,
      userId: activeUser.id,
      usedAt: null,
    });
    authRepository.findById.mockResolvedValue({ ...activeUser });

    const result = await service.resetPassword({
      token: 'raw-reset-token',
      newPassword: 'NuevaClave123',
    });

    expect(result.message).toMatch(/restablecida/i);
    expect(authRepository.save).toHaveBeenCalled();
    expect(sessionsService.revokeAllForUser).toHaveBeenCalledWith(activeUser.id);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PASSWORD_RESET' }),
    );
  });

  it('resetPassword rejects unknown or expired tokens', async () => {
    tokensRepository.findActiveByHash.mockResolvedValue(null);

    await expect(
      service.resetPassword({ token: 'expired', newPassword: 'NuevaClave123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
