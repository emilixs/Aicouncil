import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DriverType } from '@prisma/client';
import { LLMDriver } from '../interfaces/llm-driver.interface';
import { OpenAIDriver } from '../drivers/openai.driver';
import { ClaudeDriver } from '../drivers/claude.driver';
import {
  LLMAuthenticationException,
  LLMInvalidRequestException,
} from '../exceptions/llm.exception';

@Injectable()
export class DriverFactory {
  constructor(private readonly configService: ConfigService) {}

  createDriver(driverType: DriverType): LLMDriver {
    switch (driverType) {
      case DriverType.OPENAI: {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        if (!apiKey || apiKey.trim() === '') {
          throw new LLMAuthenticationException(
            'OpenAI API key not configured',
          );
        }
        return new OpenAIDriver(apiKey);
      }

      case DriverType.ANTHROPIC: {
        const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
        if (!apiKey || apiKey.trim() === '') {
          throw new LLMAuthenticationException(
            'Anthropic API key not configured',
          );
        }
        return new ClaudeDriver(apiKey);
      }

      default:
        throw new LLMInvalidRequestException(
          `Unsupported driver type: ${driverType}`,
        );
    }
  }
}

