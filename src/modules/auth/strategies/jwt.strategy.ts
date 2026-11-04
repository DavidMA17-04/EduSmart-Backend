import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { AuthService } from '../services/auth.service';
import { SessionsService } from '../services/sessions.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') ?? 'changeme',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.authService.validateUserById(Number(payload.sub));
    if (!user) {
      throw new UnauthorizedException();
    }
    if (payload.sid) {
      const active = await this.sessionsService.isActive(payload.sid, user.id);
      if (!active) {
        throw new UnauthorizedException();
      }
      user.sessionId = payload.sid;
    }
    user.mustChangePassword = Boolean(payload.mustChangePassword);
    return user;
  }
}
