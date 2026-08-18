import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '../../../common/enums/role.enum';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { AuthRepository } from '../repositories/auth.repository';
import { TokenService } from './token.service';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenService: TokenService,
  ) {}

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  async comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  async login(dto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.authRepository.findByEmail(email);
    if (!user || !(await this.comparePassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: [Role.ADMIN],
      permissions: [],
    };

    return {
      accessToken: await this.tokenService.signAccessToken(payload),
      refreshToken: await this.tokenService.signRefreshToken(payload),
    };
  }

  async logout(_user: AuthenticatedUser): Promise<{ message: string }> {
    return { message: 'Logged out' };
  }

  async changePassword(
    _user: AuthenticatedUser,
    _dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    throw new UnauthorizedException('Password change is not available yet');
  }

  async validateUserById(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.authRepository.findById(userId);
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      roles: [Role.ADMIN],
      permissions: [],
    };
  }
}
