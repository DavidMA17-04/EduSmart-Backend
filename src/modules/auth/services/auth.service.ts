import { Injectable, NotImplementedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LoginDto } from '../dto/login.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { AuthRepository } from '../repositories/auth.repository';
import { TokenService } from './token.service';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

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

  async login(_dto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    throw new NotImplementedException('Login pendiente de implementar');
  }

  async logout(_user: AuthenticatedUser): Promise<{ message: string }> {
    throw new NotImplementedException('Logout pendiente de implementar');
  }

  async changePassword(
    _user: AuthenticatedUser,
    _dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    throw new NotImplementedException('Cambio de contraseña pendiente de implementar');
  }

  async validateUserById(_userId: string): Promise<AuthenticatedUser | null> {
    return null;
  }
}
