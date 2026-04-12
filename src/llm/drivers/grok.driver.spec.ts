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

import OpenAI from 'openai';
import { GrokDriver } from './grok.driver';
import { LLMMessage, LLMConfig } from '../dto';
import {
  LLMAuthenticationException,
  LLMRateLimitException,
  LLMInvalidRequestException,
  LLMServiceException,
  LLMTimeoutException,
} from '../exceptions/llm.exception';

const mockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

const makeMessages = (): LLMMessage[] => [
  { role: 'user', content: 'Hello' },
];

const defaultConfig: LLMConfig = { model: 'grok-1' } as LLMConfig;

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
      message: { content: overrides.content ?? 'Hello from Grok' },
      finish_reason: overrides.finishReason ?? 'stop',
    },
  ],
  model: overrides.model ?? 'grok-1',
  usage: {
    prompt_tokens: overrides.promptTokens ?? 10,
    completion_tokens: overrides.completionTokens ?? 20,
    total_tokens: overrides.totalTokens ?? 30,
  },
});

describe('GrokDriver', () => {
  let driver: GrokDriver;

  beforeEach(() => {
    jest.clearAllMocks();
    driver = new GrokDriver('test-key');
  });

  describe('constructor', () => {
    it('passes apiKey and baseURL to OpenAI client', () => {
      expect(mockOpenAI).toHaveBeenCalledWith({
        apiKey: 'test-key',
        baseURL: 'https://api.x.ai/v1',
      });
    });
  });

  describe('chat()', () => {
    it('returns correct content, finishReason, usage, and model from a successful response', async () => {
      mockCreate.mockResolvedValue(
        makeSuccessResponse({
          content: 'Hi from Grok',
          finishReason: 'stop',
          model: 'grok-1',
          promptTokens: 5,
          completionTokens: 15,
          totalTokens: 20,
        }),
      );

      const result = await driver.chat(makeMessages(), defaultConfig);

      expect(result.content).toBe('Hi from Grok');
      expect(result.finishReason).toBe('stop');
      expect(result.model).toBe('grok-1');
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
        temperature: 0.3,
        maxTokens: 1024,
        topP: 0.8,
        model: 'grok-2',
      };

      await driver.chat(makeMessages(), config);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          max_tokens: 1024,
          top_p: 0.8,
          model: 'grok-2',
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

    it('maps status 401 to LLMAuthenticationException with Grok prefix', async () => {
      mockCreate.mockRejectedValue(makeApiError(401));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMAuthenticationException,
      );
    });

    it('maps status 429 to LLMRateLimitException with Grok prefix', async () => {
      mockCreate.mockRejectedValue(makeApiError(429));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMRateLimitException,
      );
    });

    it('maps status 400 to LLMInvalidRequestException with Grok prefix', async () => {
      mockCreate.mockRejectedValue(makeApiError(400));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMInvalidRequestException,
      );
    });

    it('maps status 500 to LLMServiceException with Grok prefix', async () => {
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

    it('maps unknown errors to LLMServiceException with Grok prefix', async () => {
      mockCreate.mockRejectedValue(new Error('Something completely unexpected'));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMServiceException,
      );
    });

    it('exception messages use Grok prefix', async () => {
      mockCreate.mockRejectedValue(makeApiError(401));

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toMatchObject({
        message: 'Grok authentication failed',
      });
    });

    it('maps status from error.response.status when error.status is absent', async () => {
      const err: any = new Error('Server error');
      err.response = { status: 502 };
      mockCreate.mockRejectedValue(err);

      await expect(driver.chat(makeMessages(), defaultConfig)).rejects.toBeInstanceOf(
        LLMServiceException,
      );
    });
  });

  describe('streamChat()', () => {
    it('yields content deltas from streamed chunks', async () => {
      const chunks = [
        { choices: [{ delta: { content: 'Grok' } }] },
        { choices: [{ delta: { content: ' says hi' } }] },
        { choices: [{ delta: { content: null } }] },
      ];

      mockCreate.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) yield chunk;
        },
      });

      const results: string[] = [];
      for await (const delta of driver.streamChat(makeMessages(), defaultConfig)) {
        results.push(delta);
      }

      expect(results).toEqual(['Grok', ' says hi']);
    });

    it('passes stream: true to the API', async () => {
      mockCreate.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {},
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of driver.streamChat(makeMessages(), defaultConfig)) {
        // drain
      }

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ stream: true }),
      );
    });

    it('maps errors through mapError', async () => {
      mockCreate.mockRejectedValue({ status: 429 });

      const gen = driver.streamChat(makeMessages(), defaultConfig);
      await expect(gen.next()).rejects.toBeInstanceOf(LLMRateLimitException);
    });
  });

  describe('chat() - edge cases', () => {
    it('returns empty string when choices array is empty', async () => {
      mockCreate.mockResolvedValue({
        choices: [],
        model: 'grok-1',
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      });

      const result = await driver.chat(makeMessages(), defaultConfig);

      expect(result.content).toBe('');
    });

    it('returns 0 for usage when usage is undefined', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'hi' }, finish_reason: 'stop' }],
        model: 'grok-1',
        usage: undefined,
      });

      const result = await driver.chat(makeMessages(), defaultConfig);

      expect(result.usage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
    });

    it('passes stop sequences from config', async () => {
      mockCreate.mockResolvedValue(makeSuccessResponse());

      const config: LLMConfig = {
        model: 'grok-1',
        stop: ['STOP'],
      } as LLMConfig;

      await driver.chat(makeMessages(), config);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ stop: ['STOP'] }),
      );
    });

    it('returns empty string when message content is null', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null }, finish_reason: 'stop' }],
        model: 'grok-1',
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      });

      const result = await driver.chat(makeMessages(), defaultConfig);

      expect(result.content).toBe('');
    });
  });
});
