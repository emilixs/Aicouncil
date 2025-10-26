import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DriverFactory } from './factories/driver.factory';

@Module({
  imports: [ConfigModule],
  providers: [DriverFactory],
  exports: [DriverFactory],
})
export class LlmModule {}

