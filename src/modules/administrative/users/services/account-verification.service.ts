import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import {
  ACCOUNT_VERIFICATION,
  VERIFICATION_GENERIC_RESEND,
  VERIFICATION_GENERIC_SUCCESS,
  VERIFICATION_GENERIC_VERIFY_ERROR,
} from '../../../../common/constants/account-verification.constant';
import { UserStatus } from '../../../../common/enums/user-status.enum';
import { MailService } from '../../../../integrations/mail/mail.service';
import { tryLoadInstitutionLogoAttachment } from '../../../../integrations/mail/optional-logo.attachment';
import { buildAccountVerificationMail } from '../../../../integrations/mail/templates/account-verification.mail';
import { AccountVerificationsRepository } from '../repositories/account-verifications.repository';
import { UsersRepository } from '../repositories/users.repository';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class AccountVerificationService {
  private readonly logger = new Logger(AccountVerificationService.name);

  constructor(
    private readonly verifications: AccountVerificationsRepository,
    private readonly users: UsersRepository,
    private readonly mailService: MailService,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Issues a new one-time code for a PENDING user and attempts to email it.
   * Creation of the user must already have succeeded; mail failure is non-fatal.
   */
  async issueAndSend(
    userId: number,
    actorId?: number | null,
    auditAction: 'USER_VERIFICATION_SENT' | 'USER_VERIFICATION_RESENT' = 'USER_VERIFICATION_SENT',
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || user.status !== UserStatus.PENDING || !user.email) {
      return;
    }

    const plainCode = this.generateCode();
    await this.verifications.invalidateActiveForUser(userId);

    const now = new Date();
    const row = this.verifications.create({
      userId,
      codeHash: this.hashCode(plainCode),
      expiresAt: new Date(now.getTime() + ACCOUNT_VERIFICATION.TTL_MS),
      consumedAt: null,
      attempts: 0,
      lastSentAt: now,
    });
    await this.verifications.save(row);

    try {
      const logo = tryLoadInstitutionLogoAttachment();
      const mail = buildAccountVerificationMail({
        code: plainCode,
        email: user.email,
        verifyUrl: `${this.buildPublicVerifyUrl()}/verify-account`,
        validMinutes: Math.round(ACCOUNT_VERIFICATION.TTL_MS / 60_000),
        includeLogo: Boolean(logo),
      });
      await this.mailService.sendMail({
        to: user.email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        ...(logo ? { attachments: [logo] } : {}),
      });
      await this.auditLogService.record({
        actorId: actorId ?? null,
        action: auditAction,
        entity: 'User',
        entityId: String(userId),
        after: { status: UserStatus.PENDING, mail: 'SENT' },
      });
    } catch (error) {
      const reason =
        error && typeof error === 'object' && 'code' in error && error.code === 'SMTP_NOT_CONFIGURED'
          ? 'SMTP_NOT_CONFIGURED'
          : 'SMTP_SEND_FAILED';
      this.logger.warn(
        `Verification mail failed for userId=${userId} reason=${reason}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      await this.auditLogService.record({
        actorId: actorId ?? null,
        action: 'USER_VERIFICATION_SEND_FAILED',
        entity: 'User',
        entityId: String(userId),
        after: { status: UserStatus.PENDING, mail: reason },
      });
    }
  }

  async verifyAccount(email: string, code: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();
    const fail = async (userId?: number) => {
      if (userId != null) {
        await this.auditLogService.record({
          actorId: null,
          action: 'USER_VERIFICATION_FAILED',
          entity: 'User',
          entityId: String(userId),
        });
      }
      throw new BadRequestException(VERIFICATION_GENERIC_VERIFY_ERROR);
    };

    if (!/^\d{6}$/.test(normalizedCode)) {
      await fail();
    }

    const user = await this.users.findByEmail(normalizedEmail);
    if (!user || user.status !== UserStatus.PENDING) {
      await fail(user?.id);
    }

    const active = await this.verifications.findActiveByUserId(user!.id);
    if (!active) {
      await fail(user!.id);
    }

    if (active!.expiresAt.getTime() < Date.now()) {
      active!.consumedAt = new Date();
      await this.verifications.save(active!);
      await fail(user!.id);
    }

    active!.attempts += 1;
    if (active!.attempts > ACCOUNT_VERIFICATION.MAX_ATTEMPTS) {
      active!.consumedAt = new Date();
      await this.verifications.save(active!);
      await fail(user!.id);
    }

    const matches = this.hashesMatch(active!.codeHash, this.hashCode(normalizedCode));
    if (!matches) {
      await this.verifications.save(active!);
      await fail(user!.id);
    }

    active!.consumedAt = new Date();
    await this.verifications.save(active!);

    user!.status = UserStatus.ACTIVE;
    await this.users.save(user!);

    await this.auditLogService.record({
      actorId: null,
      action: 'USER_VERIFIED',
      entity: 'User',
      entityId: String(user!.id),
      before: { status: UserStatus.PENDING },
      after: { status: UserStatus.ACTIVE },
    });

    return { message: VERIFICATION_GENERIC_SUCCESS };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.users.findByEmail(normalizedEmail);

    if (user && user.status === UserStatus.PENDING) {
      const active = await this.verifications.findActiveByUserId(user.id);
      if (active) {
        const elapsed = Date.now() - active.lastSentAt.getTime();
        if (elapsed < ACCOUNT_VERIFICATION.RESEND_COOLDOWN_MS) {
          return { message: VERIFICATION_GENERIC_RESEND };
        }
      }

      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const sentLastHour = await this.verifications.countCreatedSince(user.id, hourAgo);
      if (sentLastHour >= ACCOUNT_VERIFICATION.MAX_RESENDS_PER_HOUR) {
        return { message: VERIFICATION_GENERIC_RESEND };
      }

      const priorCodes = await this.verifications.countCreatedSince(user.id, new Date(0));
      const auditAction =
        priorCodes === 0 ? 'USER_VERIFICATION_SENT' : 'USER_VERIFICATION_RESENT';

      await this.issueAndSend(user.id, null, auditAction);
    }

    return { message: VERIFICATION_GENERIC_RESEND };
  }

  /** Exposed for unit tests only — do not use in HTTP handlers. */
  hashCodeForTests(code: string): string {
    return this.hashCode(code);
  }

  private generateCode(): string {
    return String(randomInt(0, ACCOUNT_VERIFICATION.CODE_MAX)).padStart(
      ACCOUNT_VERIFICATION.CODE_LENGTH,
      '0',
    );
  }

  private hashCode(code: string): string {
    const pepper =
      this.configService.get<string>('VERIFICATION_CODE_PEPPER') ||
      this.configService.get<string>('jwt.secret') ||
      'edusmart-verification-pepper';
    return createHmac('sha256', pepper).update(code).digest('hex');
  }

  private hashesMatch(stored: string, incoming: string): boolean {
    try {
      const a = Buffer.from(stored, 'utf8');
      const b = Buffer.from(incoming, 'utf8');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private buildPublicVerifyUrl(): string {
    return (
      this.configService.get<string>('APP_PUBLIC_URL')?.replace(/\/$/, '') ||
      'http://localhost:5173'
    );
  }
}
