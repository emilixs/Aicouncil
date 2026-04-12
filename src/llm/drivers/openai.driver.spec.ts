import { OpenAIDriver } from './openai.driver';
import {
  LLMAuthenticationException,
  LLMRateLimitException,
  LLMInvalidRequestException,
  LLMServiceException,
  LLMTimeoutException,
} from '../exceptions/llm.exception';
import { LLMMessage, LLMConfig } from '../dto';

// Mock the openai module before importing driver
jest.mock('openai');
// Mock retryWithBackoff to execute the function immediately (no retries)
jest.mock('../utils/retry.util', () => ({
  retryWithBackoff: jest.fn((fn: () => Promise<any>) => fn()),
  parseRetryAfter: jest.fn((v: string | null) => {
    if (!v) return null;
    const s = parseInt(v, 10);
    return isNaN(s) ? null : s * 1000;
  }),
}));

import OpenAI from 'openai';

const mockCreate = jest.fn();

// Cast to any to set up constructor mock
(OpenAI as any as jest.Mock).mockImplementation(() => ({
  chat: {
    completions: {
      create: mockCreate,
    },
  },
}));

const BASE_CONFIG: LLMConfig = {
  model: 'gpt-4o',
};

const MESSAGES: LLMMessage[] = [
  { role: 'user', content: 'Hello' },
];

function makeCompletionResponse(overrides: Partial<{
  content: string;
  finishReason: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}> = {}) {
  const {
    content = 'Hi there',
    finishReason = 'stop',
    model = 'gpt-4o',
    promptTokens = 10,
    completionTokens = 5,
    totalTokens = 15,
  } = overrides;
  return {
    choices: [{ message: { content }, finish_reason: finishReason }],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    },
    model,
  };
}

describe('OpenAIDriver', () => {
  let driver: OpenAIDriver;

  beforeEach(() => {
    jest.clearAllMocks();
    driver = new OpenAIDriver('test-api-key');
  });

  describe('constructor', () => {
    it('instantiates OpenAI client with provided apiKey', () => {
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });
  });

  describe('chat()', () => {
    it('returns mapped LLMResponse on success', async () => {
      mockCreate.mockResolvedValue(makeCompletionResponse());

      const result = await driver.chat(MESSAGES, BASE_CONFIG);

      expect(result).toEqual({
        content: 'Hi there',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
      });
    });

    it('passes model from config to API call', async () => {
      mockCreate.mockResolvedValue(makeCompletionResponse({ model: 'gpt-3.5-turbo' }));
      await driver.chat(MESSAGES, { model: 'gpt-3.5-turbo' });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gpt-3.5-turbo' }),
      );
    });

    it('applies default temperature=0.7 when not set', async () => {
      mockCreate.mockResolvedValue(makeCompletionResponse());
      await driver.chat(MESSAGES, BASE_CONFIG);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.7 }),
      );
    });

    it('applies default max_tokens=2000 when not set', async () => {
      mockCreate.mockResolvedValue(makeCompletionResponse());
      await driver.chat(MESSAGES, BASE_CONFIG);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 2000 }),
      );
    });

    it('applies default top_p=1.0 when not set', async () => {
      mockCreate.mockResolvedValue(makeCompletionResponse());
      await driver.chat(MESSAGES, BASE_CONFIG);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ top_p: 1.0 }),
      );
    });

    it('uses config overrides for temperature, maxTokens, topP', async () => {
      mockCreate.mockResolvedValue(makeCompletionResponse());
      await driver.chat(MESSAGES, {
        model: 'gpt-4o',
        temperature: 0.3,
        maxTokens: 512,
        topP: 0.9,
      });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.3, max_tokens: 512, top_p: 0.9 }),
      );
    });

    it('passes stop sequences from config', async () => {
      mockCreate.mockResolvedValue(makeCompletionResponse());
      await driver.chat(MESSAGES, { model: 'gpt-4o', stop: ['END'] });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ stop: ['END'] }),
      );
    });

    it('sends stream: false for non-streaming call', async () => {
      mockCreate.mockResolvedValue(makeCompletionResponse());
      await driver.chat(MESSAGES, BASE_CONFIG);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ stream: false }),
      );
    });

    it('maps all provided messages to API format', async () => {
      const msgs: LLMMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];
      mockCreate.mockResolvedValue(makeCompletionResponse());
      await driver.chat(msgs, BASE_CONFIG);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi' },
          ],
        }),
      );
    });

    it('returns empty string content when choices[0].message.content is null', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        model: 'gpt-4o',
      });
      const result = await driver.chat(MESSAGES, BASE_CONFIG);
      expect(result.content).toBe('');
    });

    it('returns zero usage when usage is undefined', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        usage: undefined,
        model: 'gpt-4o',
      });
      const result = await driver.chat(MESSAGES, BASE_CONFIG);
      expect(result.usage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
    });
  });

  describe('chat() finish reason mapping', () => {
    const cases: Array<[string | undefined, string]> = [
      ['stop', 'stop'],
      ['length', 'length'],
      ['content_filter', 'content_filter'],
      ['tool_calls', 'tool_calls'],
      [undefined, 'stop'],
      ['unknown_value', 'stop'],
    ];

    it.each(cases)(
      'maps finish_reason "%s" to "%s"',
      async (apiReason, expected) => {
        mockCreate.mockResolvedValue(makeCompletionResponse({ finishReason: apiReason as string }));
        const result = await driver.chat(MESSAGES, BASE_CONFIG);
        expect(result.finishReason).toBe(expected);
      },
    );
  });

  describe('chat() error mapping', () => {
    it('throws LLMAuthenticationException for status 401', async () => {
      mockCreate.mockRejectedValue({ status: 401 });
      await expect(driver.chat(MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMAuthenticationException,
      );
    });

    it('includes "OpenAI" in authentication error message', async () => {
      mockCreate.mockRejectedValue({ status: 401 });
      await expect(driver.chat(MESSAGES, BASE_CONFIG)).rejects.toThrow(
        /OpenAI/,
      );
    });

    it('throws LLMRateLimitException for status 429', async () => {
      mockCreate.mockRejectedValue({ status: 429 });
      await expect(driver.chat(MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMRateLimitException,
      );
    });

    it('parses retryAfter from response headers on 429', async () => {
      expect.assertions(2);
      mockCreate.mockRejectedValue({
        status: 429,
        response: { headers: { 'retry-after': '5' } },
      });
      try {
        await driver.chat(MESSAGES, BASE_CONFIG);
      } catch (err: any) {
        expect(err).toBeInstanceOf(LLMRateLimitException);
        expect(err.retryAfter).toBe(5000);
      }
    });

    it('throws LLMInvalidRequestException for status 400', async () => {
      mockCreate.mockRejectedValue({ status: 400, message: 'bad param' });
      await expect(driver.chat(MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMInvalidRequestException,
      );
    });

    it('includes error message in invalid request exception', async () => {
      mockCreate.mockRejectedValue({ status: 400, message: 'bad param' });
      await expect(driver.chat(MESSAGES, BASE_CONFIG)).rejects.toThrow(
        /bad param/,
      );
    });

    it('throws LLMServiceException for status 500', async () => {
      mockCreate.mockRejectedValue({ status: 500, message: 'internal error' });
      await expect(driver.chat(MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMServiceException,
      );
    });

    it('throws LLMServiceException for status 503', async () => {
      mockCreate.mockRejectedValue({ status: 503, message: 'unavailable' });
      await expect(driver.chat(MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMServiceException,
      );
    });

    it('throws LLMTimeoutException for code ETIMEDOUT', async () => {
      mockCreate.mockRejectedValue({ code: 'ETIMEDOUT', message: 'timed out' });
      await expect(driver.chat(MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMTimeoutException,
      );
    });

    it('throws LLMTimeoutException for code ECONNRESET', async () => {
      mockCreate.mockRejectedValue({ code: 'ECONNRESET', message: 'reset' });
      await expect(driver.chat(MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMTimeoutException,
      );
    });

    it('throws LLMTimeoutException for code ECONNREFUSED', async () => {
      mockCreate.mockRejectedValue({ code: 'ECONNREFUSED', message: 'refused' });
      await expect(driver.chat(MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMTimeoutException,
      );
    });

    it('throws LLMTimeoutException for message containing "timeout"', async () => {
      mockCreate.mockRejectedValue({ message: 'request timeout occurred' });
      await expect(driver.chat(MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMTimeoutException,
      );
    });

    it('throws LLMServiceException for unknown errors', async () => {
      mockCreate.mockRejectedValue({ message: 'something went wrong' });
      await expect(driver.chat(MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMServiceException,
      );
    });

    it('uses response.status when error.status is absent', async () => {
      mockCreate.mockRejectedValue({ response: { status: 401 } });
      await expect(driver.chat(MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMAuthenticationException,
      );
    });
  });

  describe('streamChat()', () => {
    async function* makeStream(chunks: string[]) {
      for (const c of chunks) {
        yield { choices: [{ delta: { content: c } }] };
      }
    }

    it('yields content chunks from stream', async () => {
      mockCreate.mockResolvedValue(makeStream(['Hello', ' world']));

      const chunks: string[] = [];
      for await (const chunk of driver.streamChat(MESSAGES, BASE_CONFIG)) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(['Hello', ' world']);
    });

    it('skips chunks with undefined delta content', async () => {
      async function* streamWithUndefined() {
        yield { choices: [{ delta: { content: undefined } }] };
        yield { choices: [{ delta: { content: 'real' } }] };
      }
      mockCreate.mockResolvedValue(streamWithUndefined());

      const chunks: string[] = [];
      for await (const chunk of driver.streamChat(MESSAGES, BASE_CONFIG)) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(['real']);
    });

    it('sends stream: true for streaming call', async () => {
      mockCreate.mockResolvedValue(makeStream([]));
      // consume generator
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of driver.streamChat(MESSAGES, BASE_CONFIG)) { /* empty */ }
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ stream: true }),
      );
    });

    it('maps errors in streamChat to LLMException types', async () => {
      mockCreate.mockRejectedValue({ status: 401 });
      const gen = driver.streamChat(MESSAGES, BASE_CONFIG);
      await expect(gen.next()).rejects.toBeInstanceOf(LLMAuthenticationException);
    });
  });
});
