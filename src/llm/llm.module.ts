import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DriverFactory } from './factories/driver.factory';
import { GrokDriver } from './drivers/grok.driver';

@Module({
  imports: [ConfigModule],
  providers: [DriverFactory, GrokDriver],
  exports: [DriverFactory],
})
export class LlmModule {}

