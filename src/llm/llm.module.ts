import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DriverFactory } from './factories/driver.factory';
import { OpenAIDriver } from './drivers/openai.driver';
import { ClaudeDriver } from './drivers/claude.driver';

@Module({
  imports: [ConfigModule],
  providers: [DriverFactory, OpenAIDriver, ClaudeDriver],
  exports: [DriverFactory],
})
export class LlmModule {}

