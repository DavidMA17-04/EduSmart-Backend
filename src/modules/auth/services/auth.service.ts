import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '../../../common/enums/role.enum';
import { UserStatus } from '../../../common/enums/user-status.enum';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { AuthRepository } from '../repositories/auth.repository';
import { TokenService } from './token.service';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User } from '../../administrative/users/entities/user.entity';
import { Permission } from '../../../common/constants/permissions.constant';

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
    if (
      !user ||
      !user.passwordHash ||
      !(await this.comparePassword(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.authRepository.touchLastLogin(user.id);

    const payload = this.toJwtPayload(user);

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

  async validateUserById(userId: number): Promise<AuthenticatedUser | null> {
    const user = await this.authRepository.findById(userId);
    if (!user || user.status !== UserStatus.ACTIVE) return null;
    return this.toAuthenticatedUser(user);
  }

  private toJwtPayload(user: User): JwtPayload {
    const auth = this.toAuthenticatedUser(user);
    return {
      sub: user.id,
      email: user.email,
      roles: auth.roles,
      permissions: auth.permissions,
    };
  }

  private toAuthenticatedUser(user: User): AuthenticatedUser {
    const roleNames = user.roles.map((role) => role.name);
    const isAdmin = roleNames.some(
      (name) => name.toLowerCase() === 'administrador' || name === Role.ADMIN,
    );

    const permissionCodes = user.roles.flatMap((role) =>
      role.permissions.map((permission) => permission.code),
    );

    return {
      id: user.id,
      email: user.email,
      roles: isAdmin ? [Role.ADMIN] : (roleNames as Role[]),
      permissions: [...new Set(permissionCodes)] as Permission[],
    };
  }
}
