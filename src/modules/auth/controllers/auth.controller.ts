import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { AccountVerificationService } from '../../administrative/users/services/account-verification.service';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { LoginDto } from '../dto/login.dto';
import { ResendVerificationDto } from '../dto/resend-verification.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyAccountDto } from '../dto/verify-account.dto';
import { RefreshTokenGuard } from '../guards/refresh-token.guard';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { AuthService } from '../services/auth.service';
import { PasswordRecoveryService } from '../services/password-recovery.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordRecoveryService: PasswordRecoveryService,
    private readonly accountVerificationService: AccountVerificationService,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Cerrar sesión' })
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordRecoveryService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Restablecer contraseña' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordRecoveryService.resetPassword(dto);
  }

  @ApiBearerAuth()
  @Post('change-password')
  @ApiOperation({ summary: 'Cambiar contraseña' })
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user, dto);
  }

  @Public()
  @Post('verify-account')
  @ApiOperation({ summary: 'Verificar cuenta con código enviado por correo (PBI-16)' })
  verifyAccount(@Body() dto: VerifyAccountDto) {
    return this.accountVerificationService.verifyAccount(dto.email, dto.code);
  }

  @Public()
  @Post('resend-verification')
  @ApiOperation({ summary: 'Reenviar código de verificación (PBI-16)' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.accountVerificationService.resendVerification(dto.email);
  }

  @Public()
  @UseGuards(RefreshTokenGuard)
  @ApiBearerAuth()
  @Post('refresh')
  @ApiOperation({ summary: 'Renovar access token' })
  refresh(@CurrentUser() _user: AuthenticatedUser) {
    return { message: 'Refresh token endpoint preparado (stub)' };
  }
}
