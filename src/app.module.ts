import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { LlmModule } from './llm/llm.module';
import { ExpertModule } from './expert/expert.module';
import { SessionModule } from './session/session.module';
import { MessageModule } from './message/message.module';
import { CouncilModule } from './council/council.module';
import { MemoryModule } from './memory/memory.module';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate,
    }),
    EventEmitterModule.forRoot(),
    CommonModule,
    LlmModule,
    ExpertModule,
    SessionModule,
    MessageModule,
    CouncilModule,
    MemoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
