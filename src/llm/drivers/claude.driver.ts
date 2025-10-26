import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { LLMDriver } from '../interfaces/llm-driver.interface';
import { LLMMessage, LLMConfig, LLMResponse } from '../dto';
import { retryWithBackoff, parseRetryAfter } from '../utils/retry.util';
import {
  LLMException,
  LLMAuthenticationException,
  LLMRateLimitException,
  LLMInvalidRequestException,
  LLMServiceException,
  LLMTimeoutException,
} from '../exceptions/llm.exception';

@Injectable()
export class ClaudeDriver extends LLMDriver {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    super(apiKey);
    this.client = new Anthropic({ apiKey });
  }

  async chat(
    messages: LLMMessage[],
    config: LLMConfig,
  ): Promise<LLMResponse> {
    try {
      const systemMessage = this.extractSystemMessage(messages);
      const userAssistantMessages = this.filterUserAssistantMessages(messages);

      const temperature = config.temperature ?? 0.7;
      const max_tokens = config.maxTokens ?? 2000;
      const top_p = config.topP ?? 1.0;

      const response = await retryWithBackoff(async () => {
        return await this.client.messages.create({
          model: config.model,
          system: systemMessage,
          messages: userAssistantMessages.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
          temperature,
          max_tokens,
          top_p,
          stop_sequences: config.stop,
          stream: false,
        });
      });

      const content =
        response.content[0]?.type === 'text' ? response.content[0].text : '';
      const finishReason = this.mapFinishReason(response.stop_reason);

      return {
        content,
        finishReason,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens:
            response.usage.input_tokens + response.usage.output_tokens,
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
      const systemMessage = this.extractSystemMessage(messages);
      const userAssistantMessages = this.filterUserAssistantMessages(messages);

      const temperature = config.temperature ?? 0.7;
      const max_tokens = config.maxTokens ?? 2000;
      const top_p = config.topP ?? 1.0;

      const stream = await retryWithBackoff(async () => {
        return await this.client.messages.create({
          model: config.model,
          system: systemMessage,
          messages: userAssistantMessages.map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
          temperature,
          max_tokens,
          top_p,
          stop_sequences: config.stop,
          stream: true,
        });
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const delta = event.delta.text;
          if (delta) {
            yield delta;
          }
        }
      }
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private extractSystemMessage(messages: LLMMessage[]): string | undefined {
    const systemMsg = messages.find((msg) => msg.role === 'system');
    return systemMsg?.content;
  }

  private filterUserAssistantMessages(messages: LLMMessage[]): LLMMessage[] {
    return messages.filter(
      (msg) => msg.role === 'user' || msg.role === 'assistant',
    );
  }

  private mapFinishReason(reason: string | null): LLMResponse['finishReason'] {
    if (!reason) return 'stop';

    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'stop';
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
        'Anthropic authentication failed',
        error,
      );
    }

    // Rate limit errors
    if (status === 429) {
      const parsedRetryAfterMs = parseRetryAfter(retryAfter);
      return new LLMRateLimitException(
        'Anthropic rate limit exceeded',
        error,
        parsedRetryAfterMs ?? undefined,
      );
    }

    // Invalid request errors
    if (status === 400) {
      return new LLMInvalidRequestException(
        `Anthropic invalid request: ${error?.message || 'Unknown error'}`,
        error,
      );
    }

    // Server errors
    if (status && status >= 500) {
      return new LLMServiceException(
        `Anthropic service error: ${error?.message || 'Unknown error'}`,
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
        `Anthropic request timeout: ${error?.message || 'Unknown error'}`,
        error,
      );
    }

    // Generic LLM exception for unknown errors
    return new LLMServiceException(
      `Anthropic error: ${error?.message || 'Unknown error'}`,
      error,
    );
  }
}

