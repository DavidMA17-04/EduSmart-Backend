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

  it('issueAndSend stores hash only and emails the code', async () => {
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
      expect.objectContaining({
        action: 'USER_VERIFICATION_SENT',
        after: expect.objectContaining({ mail: 'SENT' }),
      }),
    );
  });

  it('issueAndSend records SEND_FAILED when mail throws and does not throw', async () => {
    mailService.sendMail.mockRejectedValue(new Error('smtp down'));
    await expect(service.issueAndSend(user.id)).resolves.toBeUndefined();
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_VERIFICATION_SEND_FAILED',
        after: expect.objectContaining({ mail: 'SMTP_SEND_FAILED' }),
      }),
    );
    expect(auditLogService.record).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'USER_VERIFICATION_SENT' }),
    );
  });

  it('issueAndSend records SEND_FAILED with SMTP_NOT_CONFIGURED when mail rejects as such', async () => {
    const err = Object.assign(new Error('SMTP is not configured'), {
      code: 'SMTP_NOT_CONFIGURED',
    });
    mailService.sendMail.mockRejectedValue(err);
    await expect(service.issueAndSend(user.id)).resolves.toBeUndefined();
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_VERIFICATION_SEND_FAILED',
        after: expect.objectContaining({ mail: 'SMTP_NOT_CONFIGURED' }),
      }),
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

  it('resendVerification first request generates code, sends mail, keeps PENDING, audits SENT', async () => {
    verifications.findActiveByUserId.mockResolvedValue(null);
    verifications.countCreatedSince.mockResolvedValue(0);

    const result = await service.resendVerification(user.email!);

    expect(result.message).toMatch(/Si la cuenta requiere verificación/i);
    expect(mailService.sendMail).toHaveBeenCalledTimes(1);
    expect(verifications.create).toHaveBeenCalled();
    expect(users.save).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: UserStatus.ACTIVE }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_VERIFICATION_SENT',
        after: expect.objectContaining({ mail: 'SENT' }),
      }),
    );
  });

  it('resendVerification immediate second request respects cooldown and does not send', async () => {
    verifications.findActiveByUserId.mockResolvedValue({
      id: 1,
      userId: user.id,
      lastSentAt: new Date(),
      consumedAt: null,
    });
    verifications.countCreatedSince.mockResolvedValue(1);

    const result = await service.resendVerification(user.email!);

    expect(result.message).toMatch(/Si la cuenta requiere verificación/i);
    expect(mailService.sendMail).not.toHaveBeenCalled();
    expect(verifications.create).not.toHaveBeenCalled();
    expect(auditLogService.record).not.toHaveBeenCalled();
  });

  it('resendVerification after cooldown with prior codes audits RESENT', async () => {
    verifications.findActiveByUserId.mockResolvedValue({
      id: 1,
      userId: user.id,
      lastSentAt: new Date(Date.now() - ACCOUNT_VERIFICATION.RESEND_COOLDOWN_MS - 1000),
      consumedAt: null,
    });
    verifications.countCreatedSince.mockImplementation(async (_userId: number, since: Date) => {
      if (since.getTime() === 0) return 1;
      return 1;
    });

    const result = await service.resendVerification(user.email!);

    expect(result.message).toMatch(/Si la cuenta requiere verificación/i);
    expect(mailService.sendMail).toHaveBeenCalledTimes(1);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_VERIFICATION_RESENT',
        after: expect.objectContaining({ mail: 'SENT' }),
      }),
    );
  });

  it('resendVerification for ACTIVE user does not send and returns generic message', async () => {
    users.findByEmail.mockResolvedValue({
      ...user,
      status: UserStatus.ACTIVE,
    });

    const result = await service.resendVerification(user.email!);

    expect(result.message).toMatch(/Si la cuenta requiere verificación/i);
    expect(mailService.sendMail).not.toHaveBeenCalled();
    expect(verifications.create).not.toHaveBeenCalled();
  });

  it('resendVerification SMTP failure keeps PENDING and records SEND_FAILED without false success', async () => {
    verifications.findActiveByUserId.mockResolvedValue(null);
    verifications.countCreatedSince.mockResolvedValue(0);
    mailService.sendMail.mockRejectedValue(new Error('smtp down'));

    const result = await service.resendVerification(user.email!);

    expect(result.message).toMatch(/Si la cuenta requiere verificación/i);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_VERIFICATION_SEND_FAILED',
        after: expect.objectContaining({ mail: 'SMTP_SEND_FAILED' }),
      }),
    );
    expect(auditLogService.record).not.toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({ mail: 'SENT' }),
      }),
    );
    expect(users.save).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: UserStatus.ACTIVE }),
    );
  });
});
