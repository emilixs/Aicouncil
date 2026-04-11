export interface ModelPricing {
  promptPer1M: number;
  completionPer1M: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-3-opus-20240229': { promptPer1M: 15, completionPer1M: 75 },
  'claude-3-sonnet-20240229': { promptPer1M: 3, completionPer1M: 15 },
  'claude-3-haiku-20240307': { promptPer1M: 0.25, completionPer1M: 1.25 },
  'gpt-4o': { promptPer1M: 2.5, completionPer1M: 10 },
  'gpt-4o-mini': { promptPer1M: 0.15, completionPer1M: 0.6 },
  'grok-2': { promptPer1M: 2, completionPer1M: 10 },
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
