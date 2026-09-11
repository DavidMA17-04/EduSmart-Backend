import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Permission } from '../../../common/constants/permissions.constant';
import {
  ACCOUNT_PENDING_LOGIN_MESSAGE,
  AUTH_ERROR_REASON,
} from '../../../common/constants/auth-error-reason.constant';
import { Role } from '../../../common/enums/role.enum';
import { UserStatus } from '../../../common/enums/user-status.enum';
import { AuditLogService } from '../../administrative/users/services/audit-log.service';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { AuthRepository } from '../repositories/auth.repository';
import { TokenService, type SessionClientMeta } from './token.service';
import { SessionsService } from './sessions.service';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User } from '../../administrative/users/entities/user.entity';

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
  mustChangePassword: boolean;
  user: AuthUserProfile;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly sessionsService: SessionsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  async comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  async login(dto: LoginDto, meta: SessionClientMeta = {}): Promise<LoginResult> {
    const identifier = dto.identifier.trim();
    const user = await this.authRepository.findByIdentifier(identifier);

    if (!user || !user.passwordHash || !(await this.comparePassword(dto.password, user.passwordHash))) {
      await this.auditLogService.record({
        actorId: user?.id ?? null,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user ? String(user.id) : identifier,
        after: { reason: 'invalid_credentials' },
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException({
        message: ACCOUNT_PENDING_LOGIN_MESSAGE,
        reason: AUTH_ERROR_REASON.ACCOUNT_PENDING,
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      await this.auditLogService.record({
        actorId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: String(user.id),
        after: { reason: user.status },
      });
      throw new ForbiddenException(ACCOUNT_UNAVAILABLE);
    }

    await this.authRepository.touchLastLogin(user.id);
    const payload = this.toJwtPayload(user);
    const rememberMe = dto.rememberMe === true;
    const accessExpiresIn = rememberMe
      ? this.configService.getOrThrow<string>('jwt.refreshExpiresIn')
      : this.configService.getOrThrow<string>('jwt.expiresIn');

    const tokens = await this.tokenService.issueSessionTokens(payload, meta, accessExpiresIn);

    await this.auditLogService.record({
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      entity: 'User',
      entityId: String(user.id),
      after: { sessionId: tokens.session.id, rememberMe },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      mustChangePassword: user.mustChangePassword,
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

  async refresh(
    user: AuthenticatedUser,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!user.sessionId) {
      throw new UnauthorizedException('La sesión ya no es válida. Inicie sesión de nuevo.');
    }
    const session = await this.sessionsService.getActiveMatchingRefresh(
      user.sessionId,
      user.id,
      refreshToken,
    );
    const dbUser = await this.authRepository.findById(user.id);
    if (!dbUser || dbUser.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('La sesión ya no es válida. Inicie sesión de nuevo.');
    }
    return this.tokenService.rotateSession(session, this.toJwtPayload(dbUser));
  }

  async logout(user: AuthenticatedUser): Promise<{ message: string }> {
    const result = await this.sessionsService.revokeCurrent(user.sessionId);
    await this.auditLogService.record({
      actorId: user.id,
      action: 'LOGOUT',
      entity: 'User',
      entityId: String(user.id),
      after: { sessionId: user.sessionId ?? null },
    });
    return result;
  }

  async changePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const dbUser = await this.authRepository.findById(user.id);
    if (!dbUser) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!(await this.comparePassword(dto.currentPassword, dbUser.passwordHash))) {
      throw new UnauthorizedException('La contraseña actual no es correcta.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('La nueva contraseña debe ser distinta a la actual.');
    }

    dbUser.passwordHash = await this.hashPassword(dto.newPassword);
    dbUser.mustChangePassword = false;
    await this.authRepository.save(dbUser);
    await this.sessionsService.revokeAllForUser(user.id);

    await this.auditLogService.record({
      actorId: user.id,
      action: 'PASSWORD_CHANGED',
      entity: 'User',
      entityId: String(user.id),
    });

    return { message: 'Contraseña actualizada. Inicie sesión de nuevo.' };
  }

  async validateUserById(userId: number): Promise<AuthenticatedUser | null> {
    const user = await this.authRepository.findById(userId);
    if (!user || user.status !== UserStatus.ACTIVE) return null;
    return this.toAuthenticatedUser(user);
  }

  private toJwtPayload(user: User): Omit<JwtPayload, 'sid'> {
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
