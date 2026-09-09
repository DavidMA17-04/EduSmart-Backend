import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
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
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Autentica por correo o cédula. Emite JWT; rememberMe prolonga el TTL del access token.',
  })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas' })
  @ApiForbiddenResponse({ description: 'Cuenta inactiva o bloqueada' })
  @ApiResponse({ status: 200, description: 'Login exitoso con tokens y perfil' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido o usuario no activo' })
  @ApiResponse({ status: 200, description: 'Perfil sin hash de contraseña' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user);
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
