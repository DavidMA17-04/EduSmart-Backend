import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PASSWORD_RESET } from '../../../common/constants/auth-security.constant';
import { UserStatus } from '../../../common/enums/user-status.enum';
import { MailService } from '../../../integrations/mail/mail.service';
import { AuditLogService } from '../../administrative/users/services/audit-log.service';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { AuthRepository } from '../repositories/auth.repository';
import { PasswordResetTokensRepository } from '../repositories/password-reset-tokens.repository';
import { SessionsService } from './sessions.service';
import { TokenService } from './token.service';

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokensRepository: PasswordResetTokensRepository,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
    private readonly sessionsService: SessionsService,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
  ) {}

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.authRepository.findByEmail(email);

    if (user && user.status === UserStatus.ACTIVE) {
      await this.tokensRepository.invalidateOpenForUser(user.id);
      const rawToken = this.tokenService.generateResetToken();
      await this.tokensRepository.save(
        this.tokensRepository.create({
          userId: user.id,
          tokenHash: this.tokenService.hashToken(rawToken),
          expiresAt: new Date(Date.now() + PASSWORD_RESET.TTL_MS),
        }),
      );

      const url = `${this.publicAppUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
      try {
        await this.mailService.sendMail({
          to: user.email,
          subject: 'Restablecer contraseña — EduSmart',
          text: [
            'Recibimos una solicitud para restablecer su contraseña de EduSmart.',
            '',
            `Abra este enlace (válido por 60 minutos): ${url}`,
            '',
            'Si no solicitó este cambio, ignore este mensaje.',
          ].join('\n'),
          html: `<p>Recibimos una solicitud para restablecer su contraseña de EduSmart.</p>
<p><a href="${url}">Restablecer contraseña</a></p>
<p>El enlace vence en 60 minutos. Si no solicitó este cambio, ignore este mensaje.</p>`,
        });
      } catch (error) {
        this.logger.warn(`No se pudo enviar el correo de recuperación a ${user.email}`);
        this.logger.debug(error instanceof Error ? error.message : String(error));
      }

      await this.auditLogService.record({
        actorId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entity: 'User',
        entityId: String(user.id),
      });
    }

    return { message: PASSWORD_RESET.GENERIC_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const hashed = this.tokenService.hashToken(dto.token.trim());
    const record = await this.tokensRepository.findActiveByHash(hashed);
    if (!record) {
      throw new UnauthorizedException('El enlace no es válido o ya expiró. Solicite uno nuevo.');
    }

    const user = await this.authRepository.findById(record.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('El enlace no es válido o ya expiró. Solicite uno nuevo.');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.mustChangePassword = false;
    await this.authRepository.save(user);

    record.usedAt = new Date();
    await this.tokensRepository.save(record);
    await this.tokensRepository.invalidateOpenForUser(user.id);
    await this.sessionsService.revokeAllForUser(user.id);

    await this.auditLogService.record({
      actorId: user.id,
      action: 'PASSWORD_RESET',
      entity: 'User',
      entityId: String(user.id),
    });

    return { message: 'Contraseña restablecida. Ya puede iniciar sesión.' };
  }

  private publicAppUrl(): string {
    return (
      this.configService.get<string>('APP_PUBLIC_URL')?.replace(/\/$/, '') ||
      'http://localhost:5173'
    );
  }
}
