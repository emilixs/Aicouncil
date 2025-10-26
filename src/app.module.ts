import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { LlmModule } from './llm/llm.module';
import { ExpertModule } from './expert/expert.module';
import { SessionModule } from './session/session.module';
import { MessageModule } from './message/message.module';
import { CouncilModule } from './council/council.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CommonModule,
    LlmModule,
    ExpertModule,
    SessionModule,
    MessageModule,
    CouncilModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

