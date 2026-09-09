import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../administrative/users/entities/user.entity';
import { UsersModule } from '../administrative/users/users.module';
import { AuthController } from './controllers/auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RefreshTokenGuard } from './guards/refresh-token.guard';
import { AuthRepository } from './repositories/auth.repository';
import { AuthBootstrapService } from './services/auth-bootstrap.service';
import { AuthService } from './services/auth.service';
import { PasswordRecoveryService } from './services/password-recovery.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.getOrThrow<string>('jwt.expiresIn') as
            | number
            | `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthBootstrapService,
    TokenService,
    PasswordRecoveryService,
    AuthRepository,
    JwtStrategy,
    RefreshTokenStrategy,
    JwtAuthGuard,
    RefreshTokenGuard,
  ],
  exports: [AuthService, AuthRepository, JwtAuthGuard, PassportModule, JwtModule],
})
export class AuthModule {}
