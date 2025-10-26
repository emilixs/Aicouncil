import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { LLMDriver } from '../interfaces/llm-driver.interface';
import { LLMMessage, LLMConfig, LLMResponse } from '../dto';
import { retryWithBackoff } from '../utils/retry.util';
import {
  LLMException,
  LLMAuthenticationException,
  LLMRateLimitException,
  LLMInvalidRequestException,
  LLMServiceException,
  LLMTimeoutException,
} from '../exceptions/llm.exception';

@Injectable()
export class OpenAIDriver extends LLMDriver {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    super();
    this.client = new OpenAI({ apiKey });
  }

  async chat(
    messages: LLMMessage[],
    config: LLMConfig,
  ): Promise<LLMResponse> {
    try {
      const temperature = config.temperature ?? 0.7;
      const max_tokens = config.maxTokens ?? 2000;
      const top_p = config.topP ?? 1.0;

      const response = await retryWithBackoff(async () => {
        return await this.client.chat.completions.create({
          model: config.model,
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature,
          max_tokens,
          top_p,
          stop: config.stop,
          stream: false,
        });
      });

      const content = response.choices[0]?.message?.content || '';
      const finishReason = this.mapFinishReason(
        response.choices[0]?.finish_reason,
      );

      return {
        content,
        finishReason,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        model: response.model,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async *streamChat(
    messages: LLMMessage[],
    config: LLMConfig,
  ): AsyncGenerator<string, void, unknown> {
    try {
      const temperature = config.temperature ?? 0.7;
      const max_tokens = config.maxTokens ?? 2000;
      const top_p = config.topP ?? 1.0;

      const stream = await retryWithBackoff(async () => {
        return await this.client.chat.completions.create({
          model: config.model,
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature,
          max_tokens,
          top_p,
          stop: config.stop,
          stream: true,
        });
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield delta;
        }
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapFinishReason(reason: string | undefined): string {
    if (!reason) return 'stop';
    
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return reason;
    }
  }

  private mapError(error: any): LLMException {
    const status = error?.status || error?.response?.status;
    const code = error?.code;

    // Extract retry-after header if present
    const retryAfter = error?.response?.headers?.['retry-after'];

    // Authentication errors
    if (status === 401) {
      return new LLMAuthenticationException(
        'OpenAI authentication failed',
        error,
      );
    }

    // Rate limit errors
    if (status === 429) {
      return new LLMRateLimitException(
        'OpenAI rate limit exceeded',
        retryAfter ? parseInt(retryAfter, 10) : undefined,
        error,
      );
    }

    // Invalid request errors
    if (status === 400) {
      return new LLMInvalidRequestException(
        `OpenAI invalid request: ${error?.message || 'Unknown error'}`,
        error,
      );
    }

    // Server errors
    if (status && status >= 500) {
      return new LLMServiceException(
        `OpenAI service error: ${error?.message || 'Unknown error'}`,
        error,
      );
    }

    // Timeout and network errors
    if (
      code === 'ETIMEDOUT' ||
      code === 'ECONNRESET' ||
      code === 'ECONNREFUSED' ||
      error?.message?.includes('timeout')
    ) {
      return new LLMTimeoutException(
        `OpenAI request timeout: ${error?.message || 'Unknown error'}`,
        error,
      );
    }

    // Generic LLM exception for unknown errors
    return new LLMException(
      `OpenAI error: ${error?.message || 'Unknown error'}`,
      error,
    );
  }
}

