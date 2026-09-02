import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('app.nodeEnv') ?? 'development';
        const synchronize =
          nodeEnv !== 'production' &&
          (configService.get<string>('database.synchronize') ?? 'true') !== 'false';

        return {
          type: 'mysql' as const,
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          username: configService.get<string>('database.username'),
          password: configService.get<string>('database.password'),
          database: configService.get<string>('database.database'),
          autoLoadEntities: true,
          // Sprint 1: desactivar sync cuando el esquema ya existe (DB_SYNCHRONIZE=false)
          synchronize,
          charset: 'utf8mb4',
          timezone: 'Z',
          dateStrings: ['DATE'],
        };
      },
    }),
  ],
})
export class DatabaseModule {}
