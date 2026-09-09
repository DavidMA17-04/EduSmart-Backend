import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { ACCOUNT_VERIFICATION } from '../../../../common/constants/account-verification.constant';
import { AccountVerificationService } from './account-verification.service';

describe('AccountVerificationService', () => {
  const user = {
    id: 10,
    email: 'pending@ctphojancha.ed.cr',
    status: UserStatus.PENDING,
  };

  let verifications: {
    invalidateActiveForUser: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findActiveByUserId: jest.Mock;
    countCreatedSince: jest.Mock;
  };
  let users: { findById: jest.Mock; findByEmail: jest.Mock; save: jest.Mock };
  let mailService: { sendMail: jest.Mock };
  let auditLogService: { record: jest.Mock };
  let configService: { get: jest.Mock };
  let service: AccountVerificationService;
  let savedRows: Array<Record<string, unknown>>;

  beforeEach(() => {
    savedRows = [];
    verifications = {
      invalidateActiveForUser: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((data) => ({ id: 1, attempts: 0, ...data })),
      save: jest.fn(async (row) => {
        savedRows.push(row);
        return row;
      }),
      findActiveByUserId: jest.fn(),
      countCreatedSince: jest.fn().mockResolvedValue(0),
    };
    users = {
      findById: jest.fn().mockResolvedValue({ ...user }),
      findByEmail: jest.fn().mockResolvedValue({ ...user }),
      save: jest.fn(async (u) => u),
    };
    mailService = { sendMail: jest.fn().mockResolvedValue(undefined) };
    auditLogService = { record: jest.fn().mockResolvedValue(undefined) };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'VERIFICATION_CODE_PEPPER') return 'test-pepper';
        if (key === 'jwt.secret') return 'jwt-secret';
        if (key === 'APP_PUBLIC_URL') return 'http://localhost:5173';
        if (key === 'app.nodeEnv') return 'test';
        return undefined;
      }),
    };

    service = new AccountVerificationService(
      verifications as never,
      users as never,
      mailService as never,
      auditLogService as never,
      configService as never,
    );
  });

  it('issueAndSend stores hash only and emails without failing create path', async () => {
    await service.issueAndSend(user.id, 1);

    expect(verifications.invalidateActiveForUser).toHaveBeenCalledWith(user.id);
    expect(verifications.create).toHaveBeenCalled();
    const created = verifications.create.mock.calls[0][0];
    expect(created.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(created.codeHash).not.toMatch(/^\d{6}$/);
    expect(mailService.sendMail).toHaveBeenCalled();
    const mailArg = mailService.sendMail.mock.calls[0][0];
    expect(mailArg.text).toMatch(/\d{6}/);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_VERIFICATION_SENT' }),
    );
  });

  it('issueAndSend records SEND_FAILED when mail throws and does not throw', async () => {
    mailService.sendMail.mockRejectedValue(new Error('smtp down'));
    await expect(service.issueAndSend(user.id)).resolves.toBeUndefined();
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_VERIFICATION_SEND_FAILED' }),
    );
  });

  it('verifyAccount activates PENDING user with correct code', async () => {
    const code = '123456';
    const hash = service.hashCodeForTests(code);
    verifications.findActiveByUserId.mockResolvedValue({
      id: 1,
      userId: user.id,
      codeHash: hash,
      expiresAt: new Date(Date.now() + ACCOUNT_VERIFICATION.TTL_MS),
      consumedAt: null,
      attempts: 0,
    });

    const result = await service.verifyAccount(user.email!, code);
    expect(result.message).toMatch(/verificada/i);
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: UserStatus.ACTIVE }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_VERIFIED' }),
    );
  });

  it('verifyAccount rejects wrong code with generic error', async () => {
    verifications.findActiveByUserId.mockResolvedValue({
      id: 1,
      userId: user.id,
      codeHash: service.hashCodeForTests('111111'),
      expiresAt: new Date(Date.now() + ACCOUNT_VERIFICATION.TTL_MS),
      consumedAt: null,
      attempts: 0,
    });

    await expect(service.verifyAccount(user.email!, '222222')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(users.save).not.toHaveBeenCalled();
  });

  it('verifyAccount rejects expired code', async () => {
    verifications.findActiveByUserId.mockResolvedValue({
      id: 1,
      userId: user.id,
      codeHash: service.hashCodeForTests('123456'),
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null,
      attempts: 0,
    });

    await expect(service.verifyAccount(user.email!, '123456')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('resendVerification always returns generic message for unknown email', async () => {
    users.findByEmail.mockResolvedValue(null);
    const result = await service.resendVerification('nobody@example.com');
    expect(result.message).toMatch(/Si la cuenta requiere verificación/i);
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });
});
