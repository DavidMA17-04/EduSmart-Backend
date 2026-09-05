import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  // Desactivar body parser por defecto (~100kb) para aplicar límites 50mb
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const configService = app.get(ConfigService);

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  const uploadsRoot = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsRoot)) {
    mkdirSync(uploadsRoot, { recursive: true });
  }
  app.useStaticAssets(uploadsRoot, { prefix: '/uploads/' });

  app.setGlobalPrefix('api/v1');

  const configuredCorsOrigin =
    configService.get<string>('app.corsOrigin') ?? '*';
  const isDev =
    (configService.get<string>('app.nodeEnv') ?? 'development') !== 'production';
  const corsOrigins =
    configuredCorsOrigin === '*' || isDev
      ? true
      : configuredCorsOrigin.split(',').map((origin) => origin.trim());

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('EduSmart API')
    .setDescription(
      'API REST del Sistema Integral de Gestión Académica EduSmart.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('app.port') ?? 3000;
  await app.listen(port);
}

void bootstrap();
