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
      await this.mailService.sendMail({
        to: user.email,
        subject: 'Verificación de cuenta — EduSmart CTP Hojancha',
        text: this.buildPlainText(plainCode),
        html: this.buildHtml(plainCode),
      });
      await this.auditLogService.record({
        actorId: actorId ?? null,
        action: auditAction,
        entity: 'User',
        entityId: String(userId),
        after: { status: UserStatus.PENDING },
      });
    } catch (error) {
      this.logger.warn(
        `Verification mail failed for userId=${userId}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      await this.auditLogService.record({
        actorId: actorId ?? null,
        action: 'USER_VERIFICATION_SEND_FAILED',
        entity: 'User',
        entityId: String(userId),
        after: { status: UserStatus.PENDING },
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

      await this.issueAndSend(user.id, null, 'USER_VERIFICATION_RESENT');
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

  private buildPlainText(code: string): string {
    const url = `${this.buildPublicVerifyUrl()}/verify-account`;
    return [
      'Verificación de cuenta EduSmart',
      '',
      `Su código de verificación es: ${code}`,
      'Válido por 15 minutos. Es de un solo uso.',
      '',
      `Ingrese el código en: ${url}`,
      '',
      'Si usted no solicitó esta cuenta, ignore este mensaje.',
    ].join('\n');
  }

  private buildHtml(code: string): string {
    const url = `${this.buildPublicVerifyUrl()}/verify-account`;
    return `
      <p>Verificación de cuenta <strong>EduSmart</strong></p>
      <p>Su código de verificación es:</p>
      <p style="font-size:24px;letter-spacing:4px;font-weight:700">${code}</p>
      <p>Válido por 15 minutos. Es de un solo uso.</p>
      <p><a href="${url}">Abrir pantalla de verificación</a></p>
      <p>Si usted no solicitó esta cuenta, ignore este mensaje.</p>
    `;
  }
}
