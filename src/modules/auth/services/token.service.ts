import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

type ExpiresIn = `${number}${'s' | 'm' | 'h' | 'd'}`;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(
      { ...payload },
      {
        secret: this.configService.getOrThrow<string>('jwt.secret'),
        expiresIn: this.configService.getOrThrow<string>('jwt.expiresIn') as ExpiresIn,
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
}
