import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

const INVALID_CREDENTIALS = 'Credenciales inválidas';
const ACCOUNT_UNAVAILABLE = 'Cuenta inactiva o bloqueada';

export type AuthUserProfile = {
  id: number;
  email: string;
  national_id: string;
  name: string;
  first_lastname: string;
  second_lastname?: string | null;
  status: UserStatus;
  roles: string[];
  permissions: Permission[];
  mustChangePassword: boolean;
};

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  user: AuthUserProfile;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  async comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.authRepository.findByIdentifier(dto.identifier);
    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(ACCOUNT_UNAVAILABLE);
    }

    if (
      !user.passwordHash ||
      !(await this.comparePassword(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    await this.authRepository.touchLastLogin(user.id);

    const payload = this.toJwtPayload(user);
    const rememberMe = dto.rememberMe === true;
    const accessExpiresIn = rememberMe
      ? this.configService.getOrThrow<string>('jwt.refreshExpiresIn')
      : this.configService.getOrThrow<string>('jwt.expiresIn');

    return {
      accessToken: await this.tokenService.signAccessToken(payload, accessExpiresIn),
      refreshToken: await this.tokenService.signRefreshToken(payload),
      user: this.toUserProfile(user),
    };
  }

  async getMe(actor: AuthenticatedUser): Promise<AuthUserProfile> {
    const user = await this.authRepository.findById(actor.id);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return this.toUserProfile(user);
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
      mustChangePassword: auth.mustChangePassword,
    };
  }

  private toAuthenticatedUser(user: User): AuthenticatedUser {
    const roleNames = user.roles.map((role) => role.name);
    const isAdmin = roleNames.some(
      (name) => name.toLowerCase() === 'administrador' || name === Role.ADMIN,
    );

    const permissionCodes = user.roles.flatMap((role) =>
      (role.permissions ?? []).map((permission) => permission.code),
    );

    return {
      id: user.id,
      email: user.email,
      roles: isAdmin ? [Role.ADMIN] : (roleNames as Role[]),
      permissions: [...new Set(permissionCodes)] as Permission[],
      mustChangePassword: Boolean(user.mustChangePassword),
    };
  }

  private toUserProfile(user: User): AuthUserProfile {
    const auth = this.toAuthenticatedUser(user);
    return {
      id: user.id,
      email: user.email,
      national_id: user.national_id,
      name: user.name,
      first_lastname: user.first_lastname,
      second_lastname: user.second_lastname ?? null,
      status: user.status,
      roles: auth.roles,
      permissions: auth.permissions,
      mustChangePassword: auth.mustChangePassword,
    };
  }
}
