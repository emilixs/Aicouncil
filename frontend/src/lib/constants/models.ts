import { DriverType } from "@/types";

export const MODEL_OPTIONS: Record<DriverType, { value: string; label: string }[]> = {
  [DriverType.OPENAI]: [
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
};

