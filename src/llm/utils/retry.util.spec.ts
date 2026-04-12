jest.mock('node:timers/promises', () => ({
  setTimeout: jest.fn().mockResolvedValue(undefined),
}));

import { isRetryableError, parseRetryAfter, retryWithBackoff } from './retry.util';

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

  it('returns true for statusCode property', () => {
    expect(isRetryableError({ statusCode: 429 })).toBe(true);
  });

  it('returns true for response.status property', () => {
    expect(isRetryableError({ response: { status: 503 } })).toBe(true);
  });

  it.each([
    ['ETIMEDOUT'],
    ['ESOCKETTIMEDOUT'],
    ['ECONNRESET'],
    ['ECONNREFUSED'],
    ['EAI_AGAIN'],
    ['ENOTFOUND'],
  ])('returns true for network code %s', (code) => {
    expect(isRetryableError({ code })).toBe(true);
  });

  it('returns false for status 400', () => {
    expect(isRetryableError({ status: 400 })).toBe(false);
  });

  it('returns false for status 401', () => {
    expect(isRetryableError({ status: 401 })).toBe(false);
  });

  it('returns false for error with no status', () => {
    expect(isRetryableError(new Error('some error'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isRetryableError(null)).toBe(false);
  });
});

describe('parseRetryAfter', () => {
  it('returns null for null input', () => {
    expect(parseRetryAfter(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseRetryAfter('')).toBeNull();
  });

  it('converts numeric string "5" to 5000ms', () => {
    expect(parseRetryAfter('5')).toBe(5000);
  });

  it('converts numeric string "30" to 30000ms', () => {
    expect(parseRetryAfter('30')).toBe(30000);
  });

  it('converts numeric string "0" to 0ms', () => {
    expect(parseRetryAfter('0')).toBe(0);
  });

  it('parses a valid HTTP date and returns ms from now', () => {
    const futureDate = new Date(Date.now() + 10000);
    const result = parseRetryAfter(futureDate.toUTCString());
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(10000);
  });

  it('returns null for an invalid string', () => {
    expect(parseRetryAfter('not-a-date-or-number')).toBeNull();
  });
});

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the result on first successful call', async () => {
    const fn = jest.fn().mockResolvedValue('success');

    const result = await retryWithBackoff(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on a retryable error then succeeds', async () => {
    const retryableError = { status: 503, message: 'Service unavailable' };
    const fn = jest
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValue('eventual success');

    const result = await retryWithBackoff(fn, { maxRetries: 3 });

    expect(result).toBe('eventual success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately on a non-retryable error without retrying', async () => {
    const nonRetryableError = { status: 400, message: 'Bad request' };
    const fn = jest.fn().mockRejectedValue(nonRetryableError);

    await expect(retryWithBackoff(fn, { maxRetries: 3 })).rejects.toBe(nonRetryableError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting maxRetries on a persistent retryable error', async () => {
    const retryableError = { status: 503, message: 'Service unavailable' };
    const fn = jest.fn().mockRejectedValue(retryableError);

    await expect(retryWithBackoff(fn, { maxRetries: 3 })).rejects.toBe(retryableError);
    // 1 initial attempt + 3 retries = 4 total calls
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('calls onRetry callback with error, attempt number, and delay on each retry', async () => {
    const retryableError = { status: 429, message: 'Rate limited' };
    const fn = jest
      .fn()
      .mockRejectedValueOnce(retryableError)
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValue('done');

    const onRetry = jest.fn();

    await retryWithBackoff(fn, { maxRetries: 3, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, retryableError, 1, expect.any(Number));
    expect(onRetry).toHaveBeenNthCalledWith(2, retryableError, 2, expect.any(Number));
  });
});
