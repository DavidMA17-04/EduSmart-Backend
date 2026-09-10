import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SESSION_MESSAGES } from '../../../common/constants/auth-security.constant';
import { AuditLogService } from '../../administrative/users/services/audit-log.service';
import { UserSession } from '../entities/user-session.entity';
import { UserSessionsRepository } from '../repositories/user-sessions.repository';
import { TokenService } from './token.service';

export interface SessionView {
  id: number;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  current: boolean;
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly repository: UserSessionsRepository,
    private readonly tokenService: TokenService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async isActive(sessionId: number, userId: number): Promise<boolean> {
    const session = await this.repository.findById(sessionId);
    if (!session || session.userId !== userId) return false;
    if (session.revokedAt) return false;
    return session.expiresAt.getTime() > Date.now();
  }

  async getActiveMatchingRefresh(
    sessionId: number,
    userId: number,
    refreshToken: string,
  ): Promise<UserSession> {
    const session = await this.repository.findById(sessionId);
    if (
      !session ||
      session.userId !== userId ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now() ||
      !this.tokenService.hashesMatch(session.refreshTokenHash, this.tokenService.hashToken(refreshToken))
    ) {
      throw new UnauthorizedException('La sesión ya no es válida. Inicie sesión de nuevo.');
    }
    return session;
  }

  async listForUser(userId: number, currentSessionId?: number): Promise<SessionView[]> {
    const sessions = await this.repository.findActiveByUser(userId);
    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent ?? null,
      ipAddress: session.ipAddress ?? null,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt ?? null,
      expiresAt: session.expiresAt,
      current: currentSessionId === session.id,
    }));
  }

  async revokeForUser(userId: number, sessionId: number): Promise<{ message: string }> {
    const session = await this.repository.findById(sessionId);
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Sesión no encontrada.');
    }
    if (session.revokedAt) {
      return { message: SESSION_MESSAGES.REVOKED };
    }
    await this.repository.revoke(sessionId);
    await this.auditLogService.record({
      actorId: userId,
      action: 'SESSION_REVOKED',
      entity: 'UserSession',
      entityId: String(sessionId),
    });
    return { message: SESSION_MESSAGES.REVOKED };
  }

  async revokeCurrent(sessionId?: number): Promise<{ message: string }> {
    if (!sessionId) {
      return { message: SESSION_MESSAGES.LOGGED_OUT };
    }
    const session = await this.repository.findById(sessionId);
    if (!session) {
      return { message: SESSION_MESSAGES.LOGGED_OUT };
    }
    if (!session.revokedAt) {
      await this.repository.revoke(sessionId);
    }
    return { message: SESSION_MESSAGES.LOGGED_OUT };
  }

  async revokeAll(userId: number, actorId: number): Promise<{ message: string }> {
    if (userId !== actorId) {
      throw new ForbiddenException('No puede cerrar sesiones de otro usuario.');
    }
    await this.repository.revokeAllForUser(userId);
    await this.auditLogService.record({
      actorId,
      action: 'LOGOUT_ALL',
      entity: 'User',
      entityId: String(userId),
    });
    return { message: SESSION_MESSAGES.ALL_REVOKED };
  }

  async revokeAllForUser(userId: number): Promise<void> {
    await this.repository.revokeAllForUser(userId);
  }
}
