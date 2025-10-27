import { DriverType } from "@/types";

/**
 * Model options for each LLM provider.
 * Model availability may vary by API tier and region.
 * Check provider documentation for latest models and deprecations.
 */
export const MODEL_OPTIONS: Record<DriverType, { value: string; label: string }[]> = {
  [DriverType.OPENAI]: [
    // Latest GPT-4.1 family
    { value: "gpt-4.1", label: "GPT-4.1" },
    { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    { value: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
    // Reasoning models
    { value: "o3", label: "o3" },
    { value: "o3-mini", label: "o3 Mini" },
    { value: "o3-pro", label: "o3 Pro" },
    { value: "o4-mini", label: "o4 Mini" },
    // GPT-4o family
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    // Realtime models
    { value: "gpt-realtime", label: "GPT Realtime" },
    { value: "gpt-realtime-mini", label: "GPT Realtime Mini" },
    // Legacy models
    { value: "gpt-4", label: "GPT-4" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  ],
  [DriverType.ANTHROPIC]: [
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
    { value: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet" },
    { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
  ],
  [DriverType.GROK]: [
    // Flagship models
    { value: "grok-4-0709", label: "Grok 4" },
    { value: "grok-4-latest", label: "Grok 4 Latest" },
    // Fast reasoning variants
    { value: "grok-4-fast-reasoning", label: "Grok 4 Fast Reasoning" },
    { value: "grok-4-fast-reasoning-latest", label: "Grok 4 Fast Reasoning Latest" },
    // Fast non-reasoning variants
    { value: "grok-4-fast-non-reasoning", label: "Grok 4 Fast Non-Reasoning" },
    { value: "grok-4-fast-non-reasoning-latest", label: "Grok 4 Fast Non-Reasoning Latest" },
    // Previous generation
    { value: "grok-3", label: "Grok 3" },
    { value: "grok-3-mini", label: "Grok 3 Mini" },
    // Specialized models
    { value: "grok-code-fast-1", label: "Grok Code Fast" },
    { value: "grok-2-vision-1212", label: "Grok 2 Vision" },
  ],
};

export const DEFAULT_CONFIG: Record<DriverType, { model: string; temperature: number; maxTokens: number; topP: number }> = {
  [DriverType.OPENAI]: {
    model: "gpt-4-turbo",
    temperature: 0.7,
    maxTokens: 2000,
    topP: 1,
  },
  [DriverType.ANTHROPIC]: {
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.7,
    maxTokens: 2000,
    topP: 1,
  },
  [DriverType.GROK]: {
    model: "grok-4-latest",
    temperature: 0.7,
    maxTokens: 2000,
    topP: 1,
  },
};

