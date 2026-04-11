import { estimateCost, MODEL_PRICING } from './pricing.config';

/**
 * RED phase tests for pricing configuration.
 *
 * These tests verify that:
 * 1. estimateCost() calculates correctly for known Claude models
 * 2. estimateCost() calculates correctly for known OpenAI models
 * 3. estimateCost() calculates correctly for known Grok models
 * 4. estimateCost() returns 0 for unknown models
 * 5. estimateCost() handles zero tokens
 * 6. MODEL_PRICING has entries for expected models
 *
 * All tests should FAIL because pricing.config.ts does not exist yet.
 */

describe('Pricing Config', () => {
  describe('MODEL_PRICING', () => {
    it('should have pricing for claude-3-opus-20240229', () => {
      expect(MODEL_PRICING['claude-3-opus-20240229']).toBeDefined();
      expect(MODEL_PRICING['claude-3-opus-20240229'].promptPer1M).toBeGreaterThan(0);
      expect(MODEL_PRICING['claude-3-opus-20240229'].completionPer1M).toBeGreaterThan(0);
    });

    it('should have pricing for claude-3-sonnet-20240229', () => {
      expect(MODEL_PRICING['claude-3-sonnet-20240229']).toBeDefined();
      expect(MODEL_PRICING['claude-3-sonnet-20240229'].promptPer1M).toBeGreaterThan(0);
    });

    it('should have pricing for claude-3-haiku-20240307', () => {
      expect(MODEL_PRICING['claude-3-haiku-20240307']).toBeDefined();
    });

    it('should have pricing for gpt-4o', () => {
      expect(MODEL_PRICING['gpt-4o']).toBeDefined();
    });

    it('should have pricing for gpt-4o-mini', () => {
      expect(MODEL_PRICING['gpt-4o-mini']).toBeDefined();
    });

    it('should have pricing for grok-2', () => {
      expect(MODEL_PRICING['grok-2']).toBeDefined();
    });
  });

  describe('estimateCost()', () => {
    it('should calculate cost correctly for claude-3-sonnet-20240229', () => {
      // With 1000 prompt tokens at $3/1M and 500 completion tokens at $15/1M:
      // (1000 * 3 + 500 * 15) / 1_000_000 = (3000 + 7500) / 1_000_000 = 0.0105
      const cost = estimateCost('claude-3-sonnet-20240229', 1000, 500);
      expect(cost).toBeCloseTo(0.0105, 4);
    });

    it('should calculate cost correctly for claude-3-opus-20240229', () => {
      // With 1000 prompt tokens at $15/1M and 500 completion tokens at $75/1M:
      // (1000 * 15 + 500 * 75) / 1_000_000 = (15000 + 37500) / 1_000_000 = 0.0525
      const cost = estimateCost('claude-3-opus-20240229', 1000, 500);
      expect(cost).toBeCloseTo(0.0525, 4);
    });

    it('should calculate cost correctly for gpt-4o', () => {
      // With 1000 prompt tokens at $2.5/1M and 500 completion tokens at $10/1M:
      // (1000 * 2.5 + 500 * 10) / 1_000_000 = (2500 + 5000) / 1_000_000 = 0.0075
      const cost = estimateCost('gpt-4o', 1000, 500);
      expect(cost).toBeCloseTo(0.0075, 4);
    });

    it('should return 0 for unknown models', () => {
      const cost = estimateCost('unknown-model-xyz', 1000, 500);
      expect(cost).toBe(0);
    });

    it('should return 0 when tokens are zero', () => {
      const cost = estimateCost('claude-3-sonnet-20240229', 0, 0);
      expect(cost).toBe(0);
    });

    it('should handle large token counts correctly', () => {
      // 1M prompt tokens at $3/1M = $3.00, 500K completion tokens at $15/1M = $7.50
      const cost = estimateCost('claude-3-sonnet-20240229', 1_000_000, 500_000);
      expect(cost).toBeCloseTo(10.5, 2);
    });
  });
});
