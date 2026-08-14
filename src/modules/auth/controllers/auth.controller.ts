import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthService } from '../services/auth.service';
import { PasswordRecoveryService } from '../services/password-recovery.service';
import { LoginDto } from '../dto/login.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { RefreshTokenGuard } from '../guards/refresh-token.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordRecoveryService: PasswordRecoveryService,
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
  @UseGuards(RefreshTokenGuard)
  @ApiBearerAuth()
  @Post('refresh')
  @ApiOperation({ summary: 'Renovar access token' })
  refresh(@CurrentUser() _user: AuthenticatedUser) {
    return { message: 'Refresh token endpoint preparado (stub)' };
  }
}
