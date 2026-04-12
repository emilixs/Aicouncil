import { DriverType } from "@/types";

/**
 * Model options for each LLM provider.
 * Model availability may vary by API tier and region.
 * Check provider documentation for latest models and deprecations.
 */
export const MODEL_OPTIONS: Record<DriverType, { value: string; label: string }[]> = {
  [DriverType.OPENAI]: [
    // GPT-5.4 family (latest)
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.4-pro", label: "GPT-5.4 Pro" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
    // GPT-5 family
    { value: "gpt-5", label: "GPT-5" },
    { value: "gpt-5-mini", label: "GPT-5 Mini" },
    { value: "gpt-5-nano", label: "GPT-5 Nano" },
    // GPT-4.1 family
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
    { value: "gpt-realtime-1.5", label: "GPT Realtime 1.5" },
    { value: "gpt-realtime", label: "GPT Realtime" },
    { value: "gpt-realtime-mini", label: "GPT Realtime Mini" },
  ],
  [DriverType.ANTHROPIC]: [
    // Claude 4.6 family (latest)
    { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    // Claude 4.5 family
    { value: "claude-opus-4-5", label: "Claude Opus 4.5" },
    { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    // Claude 4.0 family
    { value: "claude-opus-4-0", label: "Claude Opus 4.0" },
    { value: "claude-sonnet-4-0", label: "Claude Sonnet 4.0" },
  ],
  [DriverType.GROK]: [
    // Grok 4.20 family (latest)
    { value: "grok-4.20-0309-reasoning", label: "Grok 4.20 Reasoning" },
    { value: "grok-4.20-0309-non-reasoning", label: "Grok 4.20 Non-Reasoning" },
    { value: "grok-4.20-multi-agent-0309", label: "Grok 4.20 Multi-Agent" },
    // Grok 4.1 fast variants
    { value: "grok-4-1-fast-reasoning", label: "Grok 4.1 Fast Reasoning" },
    { value: "grok-4-1-fast-non-reasoning", label: "Grok 4.1 Fast Non-Reasoning" },
  ],
};

export const DEFAULT_CONFIG: Record<DriverType, { model: string; temperature: number; maxTokens: number; topP: number }> = {
  [DriverType.OPENAI]: {
    model: "gpt-5.4-mini",
    temperature: 0.7,
    maxTokens: 2000,
    topP: 1,
  },
  [DriverType.ANTHROPIC]: {
    model: "claude-sonnet-4-6",
    temperature: 0.7,
    maxTokens: 2000,
    topP: 1,
  },
  [DriverType.GROK]: {
    model: "grok-4.20-0309-reasoning",
    temperature: 0.7,
    maxTokens: 2000,
    topP: 1,
  },
};

