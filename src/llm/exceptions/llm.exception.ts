import { HttpException } from '@nestjs/common';

/**
 * Base LLM Exception
 *
 * Base class for all LLM-specific exceptions.
 * Stores the original error as `cause` for debugging.
 */
export class LLMException extends HttpException {
  /**
   * The original error that caused this exception
   */
  public readonly cause?: Error;

  constructor(message: string, statusCode: number, cause?: Error) {
    super(message, statusCode, { cause });
    this.cause = cause;
    this.name = this.constructor.name;
  }
}

/**
 * LLM Rate Limit Exception
 * 
 * Thrown when the provider returns a rate limit error (429).
 */
export class LLMRateLimitException extends LLMException {
  /**
   * Time to wait before retrying (in milliseconds)
   */
  public readonly retryAfter?: number;

  constructor(message: string, cause?: Error, retryAfter?: number) {
    super(message, 429, cause);
    this.retryAfter = retryAfter;
  }
}

/**
 * LLM Authentication Exception
 * 
 * Thrown when the API key is invalid or missing (401).
 */
export class LLMAuthenticationException extends LLMException {
  constructor(message: string, cause?: Error) {
    super(message, 401, cause);
  }
}

/**
 * LLM Invalid Request Exception
 * 
 * Thrown for malformed requests or invalid parameters (400).
 */
export class LLMInvalidRequestException extends LLMException {
  constructor(message: string, cause?: Error) {
    super(message, 400, cause);
  }
}

/**
 * LLM Service Exception
 * 
 * Thrown when the provider service is unavailable (503).
 */
export class LLMServiceException extends LLMException {
  constructor(message: string, cause?: Error) {
    super(message, 503, cause);
  }
}

/**
 * LLM Timeout Exception
 * 
 * Thrown when a request times out (408).
 */
export class LLMTimeoutException extends LLMException {
  constructor(message: string, cause?: Error) {
    super(message, 408, cause);
  }
}

