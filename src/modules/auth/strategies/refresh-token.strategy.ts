import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { Role } from '../../../common/enums/role.enum';
import { Permission } from '../../../common/constants/permissions.constant';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret') ?? 'changeme',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): AuthenticatedUser & { refreshToken: string } {
    const header = req.headers.authorization ?? '';
    const refreshToken = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    return {
      id: Number(payload.sub),
      email: payload.email,
      roles: (payload.roles ?? []) as Role[],
      permissions: (payload.permissions ?? []) as Permission[],
      sessionId: payload.sid,
      mustChangePassword: Boolean(payload.mustChangePassword),
      refreshToken,
    };
  }
}
