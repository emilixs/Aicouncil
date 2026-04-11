import { Module } from '@nestjs/common';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { MessageModule } from '../message/message.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [MessageModule, LlmModule],
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
