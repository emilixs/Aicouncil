export interface ModelPricing {
  promptPer1M: number;
  completionPer1M: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  'claude-opus-4-6': { promptPer1M: 5, completionPer1M: 25 },
  'claude-sonnet-4-6': { promptPer1M: 3, completionPer1M: 15 },
  'claude-haiku-4-5': { promptPer1M: 1, completionPer1M: 5 },
  'claude-opus-4-5': { promptPer1M: 5, completionPer1M: 25 },
  'claude-sonnet-4-5': { promptPer1M: 3, completionPer1M: 15 },
  'claude-opus-4-0': { promptPer1M: 5, completionPer1M: 25 },
  'claude-sonnet-4-0': { promptPer1M: 3, completionPer1M: 15 },
  // OpenAI
  'gpt-5.4': { promptPer1M: 2.5, completionPer1M: 10 },
  'gpt-5.4-pro': { promptPer1M: 5, completionPer1M: 20 },
  'gpt-5.4-mini': { promptPer1M: 0.4, completionPer1M: 1.6 },
  'gpt-5.4-nano': { promptPer1M: 0.1, completionPer1M: 0.4 },
  'gpt-5': { promptPer1M: 2, completionPer1M: 8 },
  'gpt-5-mini': { promptPer1M: 0.3, completionPer1M: 1.2 },
  'gpt-5-nano': { promptPer1M: 0.1, completionPer1M: 0.4 },
  'gpt-4.1': { promptPer1M: 2, completionPer1M: 8 },
  'gpt-4.1-mini': { promptPer1M: 0.4, completionPer1M: 1.6 },
  'gpt-4.1-nano': { promptPer1M: 0.1, completionPer1M: 0.4 },
  'gpt-4o': { promptPer1M: 2.5, completionPer1M: 10 },
  'gpt-4o-mini': { promptPer1M: 0.15, completionPer1M: 0.6 },
  'o3': { promptPer1M: 2, completionPer1M: 8 },
  'o3-mini': { promptPer1M: 1.1, completionPer1M: 4.4 },
  'o3-pro': { promptPer1M: 20, completionPer1M: 80 },
  'o4-mini': { promptPer1M: 1.1, completionPer1M: 4.4 },
  // Grok (xAI)
  'grok-4.20-0309-reasoning': { promptPer1M: 2, completionPer1M: 6 },
  'grok-4.20-0309-non-reasoning': { promptPer1M: 2, completionPer1M: 6 },
  'grok-4.20-multi-agent-0309': { promptPer1M: 2, completionPer1M: 6 },
  'grok-4-1-fast-reasoning': { promptPer1M: 0.2, completionPer1M: 0.5 },
  'grok-4-1-fast-non-reasoning': { promptPer1M: 0.2, completionPer1M: 0.5 },
};

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  if (promptTokens === 0 && completionTokens === 0) return 0;
  return (
    (promptTokens * pricing.promptPer1M + completionTokens * pricing.completionPer1M) / 1_000_000
  );
}
