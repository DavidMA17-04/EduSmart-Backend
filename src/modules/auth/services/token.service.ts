import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UserSession } from '../entities/user-session.entity';
import { UserSessionsRepository } from '../repositories/user-sessions.repository';

type ExpiresIn = `${number}${'s' | 'm' | 'h' | 'd'}`;

export interface SessionClientMeta {
  userAgent?: string | null;
  ipAddress?: string | null;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionsRepository: UserSessionsRepository,
  ) {}

  async signAccessToken(
    payload: JwtPayload,
    expiresInOverride?: string,
  ): Promise<string> {
    const expiresIn = (expiresInOverride ??
      this.configService.getOrThrow<string>('jwt.expiresIn')) as ExpiresIn;

    return this.jwtService.signAsync(
      { ...payload },
      {
        secret: this.configService.getOrThrow<string>('jwt.secret'),
        expiresIn,
      },
    );
  }

  async signRefreshToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(
      { ...payload },
      {
        secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.configService.getOrThrow<string>('jwt.refreshExpiresIn') as ExpiresIn,
      },
    );
  }

  async issueSessionTokens(
    payload: Omit<JwtPayload, 'sid'>,
    meta: SessionClientMeta,
    accessExpiresInOverride?: string,
  ): Promise<{ accessToken: string; refreshToken: string; session: UserSession }> {
    const expiresAt = new Date(Date.now() + this.refreshTtlMs());
    const placeholder = this.hashToken(randomBytes(32).toString('hex'));
    const session = await this.sessionsRepository.save(
      this.sessionsRepository.create({
        userId: payload.sub,
        refreshTokenHash: placeholder,
        userAgent: meta.userAgent ?? null,
        ipAddress: meta.ipAddress ?? null,
        expiresAt,
        lastUsedAt: new Date(),
      }),
    );

    const tokenPayload: JwtPayload = { ...payload, sid: session.id };
    const refreshToken = await this.signRefreshToken(tokenPayload);
    session.refreshTokenHash = this.hashToken(refreshToken);
    await this.sessionsRepository.save(session);

    return {
      accessToken: await this.signAccessToken(tokenPayload, accessExpiresInOverride),
      refreshToken,
      session,
    };
  }

  async rotateSession(
    session: UserSession,
    payload: Omit<JwtPayload, 'sid'>,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenPayload: JwtPayload = { ...payload, sid: session.id };
    const refreshToken = await this.signRefreshToken(tokenPayload);
    session.refreshTokenHash = this.hashToken(refreshToken);
    session.lastUsedAt = new Date();
    session.expiresAt = new Date(Date.now() + this.refreshTtlMs());
    await this.sessionsRepository.save(session);
    return {
      accessToken: await this.signAccessToken(tokenPayload),
      refreshToken,
    };
  }

  hashToken(token: string): string {
    const pepper =
      this.configService.get<string>('VERIFICATION_CODE_PEPPER') ||
      this.configService.get<string>('jwt.secret') ||
      'edusmart-auth-pepper';
    return createHmac('sha256', pepper).update(token).digest('hex');
  }

  hashesMatch(stored: string, incoming: string): boolean {
    try {
      const a = Buffer.from(stored, 'utf8');
      const b = Buffer.from(incoming, 'utf8');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  generateResetToken(): string {
    return randomBytes(32).toString('hex');
  }

  private refreshTtlMs(): number {
    const raw = this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const match = /^(\d+)([smhd])$/.exec(raw.trim());
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unit = match[2];
    if (unit === 's') return value * 1000;
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    return value * 24 * 60 * 60 * 1000;
  }
}
