/**
 * LLM Response DTO
 * 
 * Represents a completed chat response.
 * Provides a normalized response format across different LLM providers.
 */
export interface LLMResponse {
  /**
   * The generated text content
   */
  content: string;

  /**
   * Why the generation stopped
   */
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;

  /**
   * Token usage statistics
   */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };

  /**
   * The model that generated the response
   */
  model: string;
}

