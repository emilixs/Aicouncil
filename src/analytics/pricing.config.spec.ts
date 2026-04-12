import { estimateCost, MODEL_PRICING } from './pricing.config';

describe('Pricing Config', () => {
  describe('MODEL_PRICING', () => {
    it('should have pricing for claude-opus-4-6', () => {
      expect(MODEL_PRICING['claude-opus-4-6']).toBeDefined();
      expect(MODEL_PRICING['claude-opus-4-6'].promptPer1M).toBeGreaterThan(0);
      expect(MODEL_PRICING['claude-opus-4-6'].completionPer1M).toBeGreaterThan(0);
    });

    it('should have pricing for claude-sonnet-4-6', () => {
      expect(MODEL_PRICING['claude-sonnet-4-6']).toBeDefined();
      expect(MODEL_PRICING['claude-sonnet-4-6'].promptPer1M).toBeGreaterThan(0);
    });

    it('should have pricing for claude-haiku-4-5', () => {
      expect(MODEL_PRICING['claude-haiku-4-5']).toBeDefined();
    });

    it('should have pricing for gpt-4o', () => {
      expect(MODEL_PRICING['gpt-4o']).toBeDefined();
    });

    it('should have pricing for gpt-4o-mini', () => {
      expect(MODEL_PRICING['gpt-4o-mini']).toBeDefined();
    });

    it('should have pricing for grok-4.20-0309-reasoning', () => {
      expect(MODEL_PRICING['grok-4.20-0309-reasoning']).toBeDefined();
    });
  });

  describe('estimateCost()', () => {
    it('should calculate cost correctly for claude-sonnet-4-6', () => {
      // With 1000 prompt tokens at $3/1M and 500 completion tokens at $15/1M:
      // (1000 * 3 + 500 * 15) / 1_000_000 = (3000 + 7500) / 1_000_000 = 0.0105
      const cost = estimateCost('claude-sonnet-4-6', 1000, 500);
      expect(cost).toBeCloseTo(0.0105, 4);
    });

    it('should calculate cost correctly for claude-opus-4-6', () => {
      // With 1000 prompt tokens at $5/1M and 500 completion tokens at $25/1M:
      // (1000 * 5 + 500 * 25) / 1_000_000 = (5000 + 12500) / 1_000_000 = 0.0175
      const cost = estimateCost('claude-opus-4-6', 1000, 500);
      expect(cost).toBeCloseTo(0.0175, 4);
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
      const cost = estimateCost('claude-sonnet-4-6', 0, 0);
      expect(cost).toBe(0);
    });

    it('should handle large token counts correctly', () => {
      // 1M prompt tokens at $3/1M = $3.00, 500K completion tokens at $15/1M = $7.50
      const cost = estimateCost('claude-sonnet-4-6', 1_000_000, 500_000);
      expect(cost).toBeCloseTo(10.5, 2);
    });
  });
});
