import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
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
import { SessionsService } from '../services/sessions.service';
import { requestClientMeta } from '../utils/request-client-meta';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordRecoveryService: PasswordRecoveryService,
    private readonly accountVerificationService: AccountVerificationService,
    private readonly sessionsService: SessionsService,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Autentica por correo o cédula. Emite JWT con sesión; rememberMe prolonga el TTL del access token.',
  })
  @ApiBadRequestResponse({ description: 'Datos de entrada inválidos' })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas' })
  @ApiForbiddenResponse({ description: 'Cuenta inactiva o bloqueada' })
  @ApiResponse({ status: 200, description: 'Login exitoso con tokens y perfil' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, requestClientMeta(req));
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
  @ApiOperation({ summary: 'Cerrar sesión actual' })
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user);
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @ApiOperation({ summary: 'Cerrar todas las sesiones del usuario' })
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.revokeAll(user.id, user.id);
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
  refresh(
    @CurrentUser() user: AuthenticatedUser & { refreshToken?: string },
  ) {
    return this.authService.refresh(user, user.refreshToken ?? '');
  }

  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'Listar sesiones activas del usuario autenticado' })
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.listForUser(user.id, user.sessionId);
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Cerrar una sesión remota' })
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.sessionsService.revokeForUser(user.id, id);
  }
}
