import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Get ConfigService from the application context
  const configService = app.get(ConfigService);

  // Enable CORS for frontend communication and WebSocket support
  const corsOrigins = configService.get<string>('WS_CORS_ORIGINS', '*').split(',');
  app.enableCors({
    origin: corsOrigins.includes('*') ? true : corsOrigins,
    credentials: true,
  });

  const port = configService.get<number>('PORT', 3000);

  await app.listen(port, '0.0.0.0');

  console.log(`🚀 AI Council API is running on: http://localhost:${port}`);
}

bootstrap();

