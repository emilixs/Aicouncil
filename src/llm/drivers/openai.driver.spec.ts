const mockCreate = jest.fn();
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));
jest.mock('../utils/retry.util', () => ({
  retryWithBackoff: jest.fn((fn) => fn()),
  parseRetryAfter: jest.fn(() => null),
}));

import { OpenAIDriver } from './openai.driver';
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

const defaultConfig: LLMConfig = { model: 'gpt-4' } as LLMConfig;

const makeSuccessResponse = (overrides: Partial<{
  content: string;
  finishReason: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}> = {}) => ({
  choices: [
    {
      message: { content: overrides.content ?? 'Hello back' },
      finish_reason: overrides.finishReason ?? 'stop',
    },
  ],
  model: overrides.model ?? 'gpt-4',
  usage: {
    prompt_tokens: overrides.promptTokens ?? 10,
    completion_tokens: overrides.completionTokens ?? 20,
    total_tokens: overrides.totalTokens ?? 30,
  },
});

describe('OpenAIDriver', () => {
  let driver: OpenAIDriver;

  beforeEach(() => {
    jest.clearAllMocks();
    driver = new OpenAIDriver('test-key');
  });

  describe('chat()', () => {
    it('returns correct content, finishReason, usage, and model from a successful response', async () => {
      mockCreate.mockResolvedValue(
        makeSuccessResponse({
          content: 'Hi there',
          finishReason: 'stop',
          model: 'gpt-4o',
          promptTokens: 5,
          completionTokens: 15,
          totalTokens: 20,
        }),
      );

      const result = await driver.chat(makeMessages(), defaultConfig);

      expect(result.content).toBe('Hi there');
      expect(result.finishReason).toBe('stop');
      expect(result.model).toBe('gpt-4o');
      expect(result.usage).toEqual({
        promptTokens: 5,
        completionTokens: 15,
        totalTokens: 20,
      });
    });

    it('uses config defaults when no config values are specified', async () => {
      mockCreate.mockResolvedValue(makeSuccessResponse());

      await driver.chat(makeMessages(), defaultConfig);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
          max_tokens: 2000,
          top_p: 1.0,
          stream: false,
        }),
      );
    });

    it('passes custom config values to the API', async () => {
      mockCreate.mockResolvedValue(makeSuccessResponse());

      const config: LLMConfig = {
        temperature: 0.2,
        maxTokens: 512,
        topP: 0.9,
        model: 'gpt-3.5-turbo',
      };

      await driver.chat(makeMessages(), config);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.2,
          max_tokens: 512,
          top_p: 0.9,
          model: 'gpt-3.5-turbo',
          stream: false,
        }),
      );
    });

    it.each([
      ['stop', 'stop'],
      ['length', 'length'],
      ['content_filter', 'content_filter'],
      ['tool_calls', 'tool_calls'],
      [undefined, 'stop'],
      ['unknown_reason', 'stop'],
    ])(
      'maps finish_reason "%s" to "%s"',
      async (apiReason, expectedReason) => {
        mockCreate.mockResolvedValue(
          makeSuccessResponse({ finishReason: apiReason as string }),
        );

        const result = await driver.chat(makeMessages(), defaultConfig);

        expect(result.finishReason).toBe(expectedReason);
      },
    );
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

    it('maps status 429 to LLMRateLimitException', async () => {
      mockCreate.mockRejectedValue(makeApiError(429));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMRateLimitException,
      );
    });

    it('maps status 400 to LLMInvalidRequestException', async () => {
      mockCreate.mockRejectedValue(makeApiError(400));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMInvalidRequestException,
      );
    });

    it('maps status 500 to LLMServiceException', async () => {
      mockCreate.mockRejectedValue(makeApiError(500));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMServiceException,
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

    it('maps unknown errors to LLMServiceException', async () => {
      mockCreate.mockRejectedValue(new Error('Something completely unexpected'));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMServiceException,
      );
    });
  });
});
