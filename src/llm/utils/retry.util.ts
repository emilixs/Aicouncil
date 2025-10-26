import { setTimeout } from 'node:timers/promises';

/**
 * Retry Options
 * 
 * Configuration for exponential backoff retry logic.
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   * @default 6
   */
  maxRetries?: number;

  /**
   * Base delay in milliseconds
   * @default 500
   */
  baseDelayMs?: number;

  /**
   * Maximum delay in milliseconds
   * @default 30000
   */
  maxDelayMs?: number;

  /**
   * Maximum total time in milliseconds
   * @default 120000
   */
  maxTotalMs?: number;

  /**
   * Callback invoked on each retry attempt
   */
  onRetry?: (error: any, attempt: number, delayMs: number) => void;
}

/**
 * Check if an error is retryable
 *
 * @param error - The error to check
 * @returns True if the error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Check HTTP status codes from multiple possible locations
  const status = error?.status || error?.statusCode || error?.response?.status;
  if (status) {
    // 429 (Rate Limit), 408 (Timeout), 5xx (Server Errors)
    if (status === 429 || status === 408 || (status >= 500 && status < 600)) {
      return true;
    }
  }

  // Check network error codes
  if (error?.code) {
    const retryableCodes = [
      'ETIMEDOUT',
      'ESOCKETTIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'EAI_AGAIN',
      'ENOTFOUND',
    ];
    if (retryableCodes.includes(error.code)) {
      return true;
    }
  }

  return false;
}

/**
 * Parse Retry-After header
 * 
 * @param retryAfter - Retry-After header value (seconds or HTTP date)
 * @returns Delay in milliseconds or null
 */
export function parseRetryAfter(retryAfter: string | null): number | null {
  if (!retryAfter) {
    return null;
  }

  // Try parsing as seconds (number)
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Try parsing as HTTP date
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    const delayMs = date.getTime() - Date.now();
    return delayMs > 0 ? delayMs : 0;
  }

  return null;
}

/**
 * Retry with exponential backoff and jitter
 * 
 * Implements industry-standard retry logic with exponential backoff and full jitter.
 * Honors provider rate limit headers (Retry-After).
 * 
 * @param fn - The async function to retry
 * @param options - Retry configuration
 * @returns Promise resolving to the function result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 6,
    baseDelayMs = 500,
    maxDelayMs = 30000,
    maxTotalMs = 120000,
    onRetry,
  } = options;

  const startTime = Date.now();
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if not a retryable error
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry if we've exceeded max attempts
      if (attempt >= maxRetries) {
        throw error;
      }

      // Check if we've exceeded total time
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs >= maxTotalMs) {
        throw error;
      }

      // Calculate delay with exponential backoff and full jitter
      let delayMs: number;

      // Check for Retry-After header from multiple possible locations
      let retryAfterValue: string | null = null;

      // Check if headers is a Headers instance
      if (error?.headers?.get) {
        retryAfterValue = error.headers.get('retry-after');
      } else if (error?.headers?.['retry-after']) {
        // Check if headers is a plain object
        retryAfterValue = error.headers['retry-after'];
      }

      // Also check response.headers
      if (!retryAfterValue && error?.response?.headers?.get) {
        retryAfterValue = error.response.headers.get('retry-after');
      } else if (!retryAfterValue && error?.response?.headers?.['retry-after']) {
        retryAfterValue = error.response.headers['retry-after'];
      }

      const retryAfter = parseRetryAfter(retryAfterValue);
      if (retryAfter !== null) {
        delayMs = Math.min(retryAfter, maxDelayMs);
      } else {
        // Full jitter: random value between 0 and min(maxDelayMs, baseDelayMs * 2^attempt)
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
        const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
        delayMs = Math.floor(Math.random() * cappedDelay);
      }

      // Ensure we don't exceed total time
      const remainingMs = maxTotalMs - elapsedMs;
      delayMs = Math.min(delayMs, remainingMs);

      // Invoke retry callback if provided
      if (onRetry) {
        onRetry(error, attempt + 1, delayMs);
      }

      // Wait before retrying
      await setTimeout(delayMs);
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError;
}

