import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { appConfig, databaseConfig, jwtConfig, mailConfig, validateEnvironment } from './config';
import { DatabaseModule } from './database/database.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdministrativeModule } from './modules/administrative/administrative.module';
import { StudentsModule } from './modules/students/students.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { DisciplinaryModule } from './modules/disciplinary/disciplinary.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { AppealsModule } from './modules/appeals/appeals.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, mailConfig],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    IntegrationsModule,
    HealthModule,
    AuthModule,
    AdministrativeModule,
    StudentsModule,
    AttendanceModule,
    DisciplinaryModule,
    CommunicationsModule,
    AppealsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
