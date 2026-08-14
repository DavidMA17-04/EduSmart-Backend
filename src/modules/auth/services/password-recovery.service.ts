import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';

@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  async forgotPassword(_dto: ForgotPasswordDto): Promise<{ message: string }> {
    this.logger.debug('Password recovery requested (stub)');
    throw new NotImplementedException('Recuperación de contraseña pendiente de implementar');
  }

  async resetPassword(_dto: ResetPasswordDto): Promise<{ message: string }> {
    throw new NotImplementedException('Restablecimiento de contraseña pendiente de implementar');
  }
}
