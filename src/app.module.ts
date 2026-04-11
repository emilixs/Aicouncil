import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { LlmModule } from './llm/llm.module';
import { ExpertModule } from './expert/expert.module';
import { SessionModule } from './session/session.module';
import { MessageModule } from './message/message.module';
import { CouncilModule } from './council/council.module';
import { CustomThrottlerGuard } from './common/guards/custom-throttler.guard';
import { HttpAuthGuard } from './common/auth/http-auth.guard';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: Number(config.get('RATE_LIMIT_TTL', '60000')),
          limit: Number(config.get('RATE_LIMIT_DEFAULT', '30')),
        },
      ],
    }),
    EventEmitterModule.forRoot(),
    CommonModule,
    LlmModule,
    ExpertModule,
    SessionModule,
    MessageModule,
    CouncilModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: HttpAuthGuard,
    },
  ],
})
export class AppModule {}
