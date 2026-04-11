import { ClaudeDriver } from './claude.driver';
import {
  LLMAuthenticationException,
  LLMRateLimitException,
  LLMInvalidRequestException,
  LLMServiceException,
  LLMTimeoutException,
} from '../exceptions/llm.exception';
import { LLMMessage, LLMConfig } from '../dto';

// Mock @anthropic-ai/sdk before importing the driver
jest.mock('@anthropic-ai/sdk');
// Mock retryWithBackoff to execute the function immediately
jest.mock('../utils/retry.util', () => ({
  retryWithBackoff: jest.fn((fn: () => Promise<any>) => fn()),
  parseRetryAfter: jest.fn((v: string | null) => {
    if (!v) return null;
    const s = parseInt(v, 10);
    return isNaN(s) ? null : s * 1000;
  }),
}));

import Anthropic from '@anthropic-ai/sdk';

const mockCreate = jest.fn();

(Anthropic as any as jest.Mock).mockImplementation(() => ({
  messages: {
    create: mockCreate,
  },
}));

const BASE_CONFIG: LLMConfig = {
  model: 'claude-3-5-sonnet-20241022',
};

const USER_MESSAGES: LLMMessage[] = [
  { role: 'user', content: 'Hello Claude' },
];

function makeMessageResponse(overrides: Partial<{
  text: string;
  stopReason: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
}> = {}) {
  const {
    text = 'Hi there',
    stopReason = 'end_turn',
    model = 'claude-3-5-sonnet-20241022',
    inputTokens = 10,
    outputTokens = 5,
  } = overrides;
  return {
    content: [{ type: 'text', text }],
    stop_reason: stopReason,
    model,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

describe('ClaudeDriver', () => {
  let driver: ClaudeDriver;

  beforeEach(() => {
    jest.clearAllMocks();
    driver = new ClaudeDriver('test-anthropic-key');
  });

  describe('constructor', () => {
    it('instantiates Anthropic client with provided apiKey', () => {
      expect(Anthropic).toHaveBeenCalledWith({ apiKey: 'test-anthropic-key' });
    });
  });

  describe('chat()', () => {
    it('returns mapped LLMResponse on success', async () => {
      mockCreate.mockResolvedValue(makeMessageResponse());

      const result = await driver.chat(USER_MESSAGES, BASE_CONFIG);

      expect(result).toEqual({
        content: 'Hi there',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'claude-3-5-sonnet-20241022',
      });
    });

    it('computes totalTokens as inputTokens + outputTokens', async () => {
      mockCreate.mockResolvedValue(
        makeMessageResponse({ inputTokens: 20, outputTokens: 8 }),
      );
      const result = await driver.chat(USER_MESSAGES, BASE_CONFIG);
      expect(result.usage?.totalTokens).toBe(28);
    });

    it('applies default temperature=0.7 when not set', async () => {
      mockCreate.mockResolvedValue(makeMessageResponse());
      await driver.chat(USER_MESSAGES, BASE_CONFIG);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.7 }),
      );
    });

    it('applies default max_tokens=2000 when not set', async () => {
      mockCreate.mockResolvedValue(makeMessageResponse());
      await driver.chat(USER_MESSAGES, BASE_CONFIG);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 2000 }),
      );
    });

    it('applies default top_p=1.0 when not set', async () => {
      mockCreate.mockResolvedValue(makeMessageResponse());
      await driver.chat(USER_MESSAGES, BASE_CONFIG);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ top_p: 1.0 }),
      );
    });

    it('uses config overrides for temperature, maxTokens, topP', async () => {
      mockCreate.mockResolvedValue(makeMessageResponse());
      await driver.chat(USER_MESSAGES, {
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0.2,
        maxTokens: 1024,
        topP: 0.8,
      });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.2, max_tokens: 1024, top_p: 0.8 }),
      );
    });

    it('passes stop_sequences from config', async () => {
      mockCreate.mockResolvedValue(makeMessageResponse());
      await driver.chat(USER_MESSAGES, { model: 'claude-3-5-sonnet-20241022', stop: ['STOP'] });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ stop_sequences: ['STOP'] }),
      );
    });

    it('sends stream: false for non-streaming call', async () => {
      mockCreate.mockResolvedValue(makeMessageResponse());
      await driver.chat(USER_MESSAGES, BASE_CONFIG);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ stream: false }),
      );
    });

    it('extracts system message and passes it separately', async () => {
      mockCreate.mockResolvedValue(makeMessageResponse());
      const msgs: LLMMessage[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
      ];
      await driver.chat(msgs, BASE_CONFIG);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      );
    });

    it('passes undefined as system when no system message present', async () => {
      mockCreate.mockResolvedValue(makeMessageResponse());
      await driver.chat(USER_MESSAGES, BASE_CONFIG);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ system: undefined }),
      );
    });

    it('filters system messages from messages array', async () => {
      mockCreate.mockResolvedValue(makeMessageResponse());
      const msgs: LLMMessage[] = [
        { role: 'system', content: 'Be helpful' },
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'A1' },
        { role: 'user', content: 'Q2' },
      ];
      await driver.chat(msgs, BASE_CONFIG);
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.messages).toEqual([
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'A1' },
        { role: 'user', content: 'Q2' },
      ]);
      expect(callArg.messages.some((m: any) => m.role === 'system')).toBe(false);
    });

    it('returns empty string when content[0] is not text type', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'tool_use', id: 'tu1', name: 'fn', input: {} }],
        stop_reason: 'end_turn',
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 5, output_tokens: 2 },
      });
      const result = await driver.chat(USER_MESSAGES, BASE_CONFIG);
      expect(result.content).toBe('');
    });

    it('returns empty string when content array is empty', async () => {
      mockCreate.mockResolvedValue({
        content: [],
        stop_reason: 'end_turn',
        model: 'claude-3-5-sonnet-20241022',
        usage: { input_tokens: 0, output_tokens: 0 },
      });
      const result = await driver.chat(USER_MESSAGES, BASE_CONFIG);
      expect(result.content).toBe('');
    });
  });

  describe('chat() finish reason mapping', () => {
    const cases: Array<[string | null, string]> = [
      ['end_turn', 'stop'],
      ['max_tokens', 'length'],
      ['stop_sequence', 'stop'],
      [null, 'stop'],
      ['unknown_reason', 'stop'],
    ];

    it.each(cases)(
      'maps stop_reason "%s" to "%s"',
      async (apiReason, expected) => {
        mockCreate.mockResolvedValue(makeMessageResponse({ stopReason: apiReason }));
        const result = await driver.chat(USER_MESSAGES, BASE_CONFIG);
        expect(result.finishReason).toBe(expected);
      },
    );
  });

  describe('chat() error mapping', () => {
    it('throws LLMAuthenticationException for status 401', async () => {
      mockCreate.mockRejectedValue({ status: 401 });
      await expect(driver.chat(USER_MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMAuthenticationException,
      );
    });

    it('includes "Anthropic" in authentication error message', async () => {
      mockCreate.mockRejectedValue({ status: 401 });
      await expect(driver.chat(USER_MESSAGES, BASE_CONFIG)).rejects.toThrow(
        /Anthropic/,
      );
    });

    it('throws LLMRateLimitException for status 429', async () => {
      mockCreate.mockRejectedValue({ status: 429 });
      await expect(driver.chat(USER_MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMRateLimitException,
      );
    });

    it('parses retryAfter from response headers on 429', async () => {
      mockCreate.mockRejectedValue({
        status: 429,
        response: { headers: { 'retry-after': '10' } },
      });
      try {
        await driver.chat(USER_MESSAGES, BASE_CONFIG);
      } catch (err: any) {
        expect(err).toBeInstanceOf(LLMRateLimitException);
        expect(err.retryAfter).toBe(10000);
      }
    });

    it('throws LLMInvalidRequestException for status 400', async () => {
      mockCreate.mockRejectedValue({ status: 400, message: 'invalid model' });
      await expect(driver.chat(USER_MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMInvalidRequestException,
      );
    });

    it('includes "Anthropic" prefix in invalid request message', async () => {
      mockCreate.mockRejectedValue({ status: 400, message: 'invalid model' });
      await expect(driver.chat(USER_MESSAGES, BASE_CONFIG)).rejects.toThrow(
        /Anthropic/,
      );
    });

    it('throws LLMServiceException for status 500', async () => {
      mockCreate.mockRejectedValue({ status: 500, message: 'server error' });
      await expect(driver.chat(USER_MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMServiceException,
      );
    });

    it('throws LLMServiceException for status 503', async () => {
      mockCreate.mockRejectedValue({ status: 503 });
      await expect(driver.chat(USER_MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMServiceException,
      );
    });

    it('throws LLMTimeoutException for code ETIMEDOUT', async () => {
      mockCreate.mockRejectedValue({ code: 'ETIMEDOUT', message: 'timed out' });
      await expect(driver.chat(USER_MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMTimeoutException,
      );
    });

    it('throws LLMTimeoutException for code ECONNRESET', async () => {
      mockCreate.mockRejectedValue({ code: 'ECONNRESET', message: 'reset' });
      await expect(driver.chat(USER_MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMTimeoutException,
      );
    });

    it('throws LLMTimeoutException for code ECONNREFUSED', async () => {
      mockCreate.mockRejectedValue({ code: 'ECONNREFUSED', message: 'refused' });
      await expect(driver.chat(USER_MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMTimeoutException,
      );
    });

    it('throws LLMTimeoutException for message containing "timeout"', async () => {
      mockCreate.mockRejectedValue({ message: 'connection timeout' });
      await expect(driver.chat(USER_MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMTimeoutException,
      );
    });

    it('throws LLMServiceException for unknown errors', async () => {
      mockCreate.mockRejectedValue({ message: 'unexpected error' });
      await expect(driver.chat(USER_MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMServiceException,
      );
    });

    it('uses response.status when error.status is absent', async () => {
      mockCreate.mockRejectedValue({ response: { status: 401 } });
      await expect(driver.chat(USER_MESSAGES, BASE_CONFIG)).rejects.toBeInstanceOf(
        LLMAuthenticationException,
      );
    });
  });

  describe('streamChat()', () => {
    async function* makeEventStream(events: Array<{ type: string; text?: string }>) {
      for (const event of events) {
        if (event.type === 'content_block_delta') {
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: event.text },
          };
        } else {
          yield { type: event.type };
        }
      }
    }

    it('yields text chunks from content_block_delta events', async () => {
      mockCreate.mockResolvedValue(
        makeEventStream([
          { type: 'content_block_delta', text: 'Hello' },
          { type: 'content_block_delta', text: ' world' },
        ]),
      );

      const chunks: string[] = [];
      for await (const chunk of driver.streamChat(USER_MESSAGES, BASE_CONFIG)) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(['Hello', ' world']);
    });

    it('ignores non-content_block_delta events', async () => {
      mockCreate.mockResolvedValue(
        makeEventStream([
          { type: 'message_start' },
          { type: 'content_block_delta', text: 'data' },
          { type: 'message_stop' },
        ]),
      );

      const chunks: string[] = [];
      for await (const chunk of driver.streamChat(USER_MESSAGES, BASE_CONFIG)) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(['data']);
    });

    it('sends stream: true for streaming call', async () => {
      mockCreate.mockResolvedValue(makeEventStream([]));
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of driver.streamChat(USER_MESSAGES, BASE_CONFIG)) { /* empty */ }
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ stream: true }),
      );
    });

    it('maps errors in streamChat to LLMException types', async () => {
      mockCreate.mockRejectedValue({ status: 401 });
      const gen = driver.streamChat(USER_MESSAGES, BASE_CONFIG);
      await expect(gen.next()).rejects.toBeInstanceOf(LLMAuthenticationException);
    });
  });
});
