import { isRetryableError, parseRetryAfter, retryWithBackoff } from './retry.util';

// Mock node:timers/promises setTimeout
jest.mock('node:timers/promises', () => ({
  setTimeout: jest.fn().mockResolvedValue(undefined),
}));

import { setTimeout as mockSetTimeout } from 'node:timers/promises';

describe('isRetryableError', () => {
  it('returns true for status 429', () => {
    expect(isRetryableError({ status: 429 })).toBe(true);
  });

  it('returns true for status 408', () => {
    expect(isRetryableError({ status: 408 })).toBe(true);
  });

  it('returns true for status 500', () => {
    expect(isRetryableError({ status: 500 })).toBe(true);
  });

  it('returns true for status 503', () => {
    expect(isRetryableError({ status: 503 })).toBe(true);
  });

  it('returns true for status 599 (upper boundary of 5xx)', () => {
    expect(isRetryableError({ status: 599 })).toBe(true);
  });

  it('returns false for status 400', () => {
    expect(isRetryableError({ status: 400 })).toBe(false);
  });

  it('returns false for status 401', () => {
    expect(isRetryableError({ status: 401 })).toBe(false);
  });

  it('returns false for status 404', () => {
    expect(isRetryableError({ status: 404 })).toBe(false);
  });

  it('returns true for statusCode 429', () => {
    expect(isRetryableError({ statusCode: 429 })).toBe(true);
  });

  it('returns true for response.status 500', () => {
    expect(isRetryableError({ response: { status: 500 } })).toBe(true);
  });

  it('returns true for code ETIMEDOUT', () => {
    expect(isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
  });

  it('returns true for code ESOCKETTIMEDOUT', () => {
    expect(isRetryableError({ code: 'ESOCKETTIMEDOUT' })).toBe(true);
  });

  it('returns true for code ECONNRESET', () => {
    expect(isRetryableError({ code: 'ECONNRESET' })).toBe(true);
  });

  it('returns true for code ECONNREFUSED', () => {
    expect(isRetryableError({ code: 'ECONNREFUSED' })).toBe(true);
  });

  it('returns true for code EAI_AGAIN', () => {
    expect(isRetryableError({ code: 'EAI_AGAIN' })).toBe(true);
  });

  it('returns true for code ENOTFOUND', () => {
    expect(isRetryableError({ code: 'ENOTFOUND' })).toBe(true);
  });

  it('returns false for unknown error code', () => {
    expect(isRetryableError({ code: 'ENOENT' })).toBe(false);
  });

  it('returns false for null/undefined error', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError({})).toBe(false);
  });
});

describe('parseRetryAfter', () => {
  it('returns null for null input', () => {
    expect(parseRetryAfter(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseRetryAfter('')).toBeNull();
  });

  it('parses seconds as a number string', () => {
    expect(parseRetryAfter('5')).toBe(5000);
  });

  it('parses 0 seconds', () => {
    expect(parseRetryAfter('0')).toBe(0);
  });

  it('parses a future HTTP date string', () => {
    const futureDate = new Date(Date.now() + 10000);
    const result = parseRetryAfter(futureDate.toUTCString());
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(10000);
  });

  it('returns 0 for a past HTTP date string', () => {
    const pastDate = new Date(Date.now() - 5000);
    const result = parseRetryAfter(pastDate.toUTCString());
    expect(result).toBe(0);
  });

  it('returns null for an unparseable string', () => {
    expect(parseRetryAfter('not-a-date-or-number')).toBeNull();
  });
});

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and returns on subsequent success', async () => {
    const retryableError = { status: 500 };
    const fn = jest
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValue('recovered');

    const result = await retryWithBackoff(fn, { maxRetries: 3 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(mockSetTimeout).toHaveBeenCalledTimes(1);
  });

  it('throws immediately for non-retryable errors', async () => {
    const nonRetryableError = { status: 400, message: 'bad request' };
    const fn = jest.fn().mockRejectedValue(nonRetryableError);

    await expect(retryWithBackoff(fn)).rejects.toEqual(nonRetryableError);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockSetTimeout).not.toHaveBeenCalled();
  });

  it('throws after maxRetries exhausted', async () => {
    const retryableError = { status: 503 };
    const fn = jest.fn().mockRejectedValue(retryableError);

    await expect(retryWithBackoff(fn, { maxRetries: 2 })).rejects.toEqual(
      retryableError,
    );
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    expect(mockSetTimeout).toHaveBeenCalledTimes(2);
  });

  it('invokes onRetry callback with attempt and delay', async () => {
    const retryableError = { status: 429 };
    const fn = jest
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValue('done');
    const onRetry = jest.fn();

    await retryWithBackoff(fn, { maxRetries: 2, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(retryableError, 1, expect.any(Number));
  });

  it('honors Retry-After header from error.headers plain object', async () => {
    const retryableError = {
      status: 429,
      headers: { 'retry-after': '2' },
    };
    const fn = jest
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValue('ok');

    await retryWithBackoff(fn, { maxRetries: 2 });
    const [[delayArg]] = (mockSetTimeout as jest.Mock).mock.calls;
    expect(delayArg).toBe(2000);
  });

  it('honors Retry-After header from error.headers.get() (Headers instance)', async () => {
    const retryableError = {
      status: 429,
      headers: { get: (key: string) => (key === 'retry-after' ? '3' : null) },
    };
    const fn = jest
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValue('ok');

    await retryWithBackoff(fn, { maxRetries: 2 });
    const [[delayArg]] = (mockSetTimeout as jest.Mock).mock.calls;
    expect(delayArg).toBe(3000);
  });

  it('honors Retry-After header from error.response.headers plain object', async () => {
    const retryableError = {
      status: 429,
      response: { headers: { 'retry-after': '1' } },
    };
    const fn = jest
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValue('ok');

    await retryWithBackoff(fn, { maxRetries: 2 });
    const [[delayArg]] = (mockSetTimeout as jest.Mock).mock.calls;
    expect(delayArg).toBe(1000);
  });

  it('caps delay at maxDelayMs', async () => {
    const retryableError = {
      status: 429,
      headers: { 'retry-after': '9999' },
    };
    const fn = jest
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValue('ok');

    await retryWithBackoff(fn, { maxRetries: 2, maxDelayMs: 5000 });
    const [[delayArg]] = (mockSetTimeout as jest.Mock).mock.calls;
    expect(delayArg).toBe(5000);
  });

  it('throws if elapsed time exceeds maxTotalMs', async () => {
    let callCount = 0;
    const retryableError = { status: 503 };

    // Simulate time passing by overriding Date.now
    const realNow = Date.now;
    let fakeNow = realNow();
    jest.spyOn(Date, 'now').mockImplementation(() => {
      // First call is startTime; subsequent calls simulate elapsed time
      callCount++;
      if (callCount > 1) fakeNow += 200000; // jump past maxTotalMs
      return fakeNow;
    });

    const fn = jest
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValue('ok');

    await expect(
      retryWithBackoff(fn, { maxRetries: 5, maxTotalMs: 100000 }),
    ).rejects.toEqual(retryableError);

    jest.spyOn(Date, 'now').mockRestore();
  });
});
