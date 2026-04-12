const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));
jest.mock('../utils/retry.util', () => ({
  retryWithBackoff: jest.fn((fn) => fn()),
  parseRetryAfter: jest.fn(() => null),
}));

import { ClaudeDriver } from './claude.driver';
import { LLMMessage, LLMConfig } from '../dto';
import {
  LLMAuthenticationException,
  LLMRateLimitException,
  LLMInvalidRequestException,
  LLMServiceException,
  LLMTimeoutException,
} from '../exceptions/llm.exception';

const makeMessages = (): LLMMessage[] => [
  { role: 'user', content: 'Hello' },
];

const defaultConfig: LLMConfig = { model: 'claude-3-5-sonnet-20241022' } as LLMConfig;

const makeSuccessResponse = (overrides: Partial<{
  text: string;
  stopReason: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  contentType: string;
}> = {}) => ({
  content: [
    {
      type: overrides.contentType ?? 'text',
      text: overrides.text ?? 'Hello back',
    },
  ],
  stop_reason: overrides.stopReason !== undefined ? overrides.stopReason : 'end_turn',
  model: overrides.model ?? 'claude-3-5-sonnet-20241022',
  usage: {
    input_tokens: overrides.inputTokens ?? 10,
    output_tokens: overrides.outputTokens ?? 20,
  },
});

describe('ClaudeDriver', () => {
  let driver: ClaudeDriver;

  beforeEach(() => {
    jest.clearAllMocks();
    driver = new ClaudeDriver('test-key');
  });

  describe('chat()', () => {
    it('returns correct content, finishReason, usage, and model from a successful response', async () => {
      mockCreate.mockResolvedValue(
        makeSuccessResponse({
          text: 'Hi there',
          stopReason: 'end_turn',
          model: 'claude-3-5-sonnet-20241022',
          inputTokens: 5,
          outputTokens: 15,
        }),
      );

      const result = await driver.chat(makeMessages(), { model: 'claude-3-5-sonnet-20241022' });

      expect(result.content).toBe('Hi there');
      expect(result.finishReason).toBe('stop');
      expect(result.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.usage).toEqual({
        promptTokens: 5,
        completionTokens: 15,
        totalTokens: 20,
      });
    });

    it('extracts system message and passes it as the system param', async () => {
      mockCreate.mockResolvedValue(makeSuccessResponse());

      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
      ];

      await driver.chat(messages, { model: 'claude-3-5-sonnet-20241022' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant.',
        }),
      );
    });

    it('filters out system messages from the messages array passed to the API', async () => {
      mockCreate.mockResolvedValue(makeSuccessResponse());

      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ];

      await driver.chat(messages, { model: 'claude-3-5-sonnet-20241022' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi!' },
          ],
        }),
      );
    });

    it('uses config defaults when no optional config values are specified', async () => {
      mockCreate.mockResolvedValue(makeSuccessResponse());

      await driver.chat(makeMessages(), { model: 'claude-3-opus-20240229' });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
          max_tokens: 2000,
          top_p: 1.0,
          stream: false,
        }),
      );
    });

    it.each([
      ['end_turn', 'stop'],
      ['max_tokens', 'length'],
      ['stop_sequence', 'stop'],
      [null, 'stop'],
      ['unknown_reason', 'stop'],
    ])(
      'maps stop_reason "%s" to finishReason "%s"',
      async (apiReason, expectedReason) => {
        mockCreate.mockResolvedValue(
          makeSuccessResponse({ stopReason: apiReason }),
        );

        const result = await driver.chat(makeMessages(), { model: 'claude-3-5-sonnet-20241022' });

        expect(result.finishReason).toBe(expectedReason);
      },
    );

    it('returns empty string for non-text content block', async () => {
      mockCreate.mockResolvedValue(
        makeSuccessResponse({ contentType: 'tool_use' }),
      );

      const result = await driver.chat(makeMessages(), { model: 'claude-3-5-sonnet-20241022' });

      expect(result.content).toBe('');
    });
  });

  describe('error mapping', () => {
    const makeApiError = (
      status?: number,
      code?: string,
      message = 'API error',
    ) => {
      const err: any = new Error(message);
      if (status !== undefined) err.status = status;
      if (code !== undefined) err.code = code;
      return err;
    };

    it('maps status 401 to LLMAuthenticationException', async () => {
      mockCreate.mockRejectedValue(makeApiError(401));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMAuthenticationException,
      );
    });

    it('maps status 401 error message to include "Anthropic"', async () => {
      mockCreate.mockRejectedValue(makeApiError(401));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toThrow(
        'Anthropic authentication failed',
      );
    });

    it('maps status 429 to LLMRateLimitException', async () => {
      mockCreate.mockRejectedValue(makeApiError(429));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMRateLimitException,
      );
    });

    it('maps status 429 error message to include "Anthropic"', async () => {
      mockCreate.mockRejectedValue(makeApiError(429));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toThrow(
        'Anthropic rate limit exceeded',
      );
    });

    it('maps status 400 to LLMInvalidRequestException', async () => {
      mockCreate.mockRejectedValue(makeApiError(400));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMInvalidRequestException,
      );
    });

    it('maps status 400 error message to include "Anthropic"', async () => {
      mockCreate.mockRejectedValue(makeApiError(400, undefined, 'Bad param'));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toThrow(
        'Anthropic invalid request: Bad param',
      );
    });

    it('maps status 500 to LLMServiceException', async () => {
      mockCreate.mockRejectedValue(makeApiError(500));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMServiceException,
      );
    });

    it('maps status 503 to LLMServiceException', async () => {
      mockCreate.mockRejectedValue(makeApiError(503));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMServiceException,
      );
    });

    it('maps status 500+ error message to include "Anthropic"', async () => {
      mockCreate.mockRejectedValue(makeApiError(502, undefined, 'Bad gateway'));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toThrow(
        'Anthropic service error: Bad gateway',
      );
    });

    it('maps ETIMEDOUT network code to LLMTimeoutException', async () => {
      mockCreate.mockRejectedValue(makeApiError(undefined, 'ETIMEDOUT'));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMTimeoutException,
      );
    });

    it('maps ECONNRESET network code to LLMTimeoutException', async () => {
      mockCreate.mockRejectedValue(makeApiError(undefined, 'ECONNRESET'));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMTimeoutException,
      );
    });

    it('maps ECONNREFUSED network code to LLMTimeoutException', async () => {
      mockCreate.mockRejectedValue(makeApiError(undefined, 'ECONNREFUSED'));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMTimeoutException,
      );
    });

    it('maps error message containing "timeout" to LLMTimeoutException', async () => {
      mockCreate.mockRejectedValue(makeApiError(undefined, undefined, 'Request timeout exceeded'));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMTimeoutException,
      );
    });

    it('maps timeout error message to include "Anthropic"', async () => {
      mockCreate.mockRejectedValue(makeApiError(undefined, 'ETIMEDOUT', 'ETIMEDOUT'));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toThrow(
        'Anthropic request timeout',
      );
    });

    it('maps unknown errors to LLMServiceException', async () => {
      mockCreate.mockRejectedValue(new Error('Something completely unexpected'));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMServiceException,
      );
    });

    it('maps unknown errors message to include "Anthropic"', async () => {
      mockCreate.mockRejectedValue(new Error('Something completely unexpected'));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toThrow(
        'Anthropic error: Something completely unexpected',
      );
    });
  });
});
