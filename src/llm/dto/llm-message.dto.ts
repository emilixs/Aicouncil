/**
 * LLM Message DTO
 * 
 * Represents a single message in a conversation.
 * Provides a provider-agnostic message format that can be mapped
 * to OpenAI and Anthropic SDK formats.
 */
export interface LLMMessage {
  /**
   * The role of the message sender
   */
  role: 'user' | 'assistant' | 'system';

  /**
   * The message content
   */
  content: string;
}

