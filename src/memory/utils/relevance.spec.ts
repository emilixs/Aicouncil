import {
  calculateRecencyBoost,
  calculateTopicOverlap,
  calculateEffectiveRelevance,
  scoreMemory,
} from './relevance';

describe('calculateRecencyBoost', () => {
  it('should return 1.0 for memories created today', () => {
    const now = new Date();
    expect(calculateRecencyBoost(now)).toBeCloseTo(1.0);
  });

  it('should decay by 0.1 per week', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    expect(calculateRecencyBoost(twoWeeksAgo)).toBeCloseTo(0.8, 1);
  });

  it('should have a floor of 0.3', () => {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    expect(calculateRecencyBoost(oneYearAgo)).toBeCloseTo(0.3);
  });
});

describe('calculateTopicOverlap', () => {
  it('should return 1.0 for identical topic sets', () => {
    expect(calculateTopicOverlap(['api', 'auth'], ['api', 'auth'])).toBeCloseTo(1.0);
  });

  it('should return 0.2 floor for completely disjoint topics', () => {
    expect(calculateTopicOverlap(['api', 'auth'], ['database', 'migration'])).toBeCloseTo(0.2);
  });

  it('should calculate Jaccard similarity correctly', () => {
    // intersection = {api}, union = {api, auth, design} => 1/3 = 0.333
    const result = calculateTopicOverlap(['api', 'auth'], ['api', 'design']);
    expect(result).toBeCloseTo(1 / 3);
  });

  it('should return 0.2 floor when one set is empty', () => {
    expect(calculateTopicOverlap([], ['api', 'auth'])).toBeCloseTo(0.2);
  });
});

describe('calculateEffectiveRelevance', () => {
  it('should apply decay formula to base relevance', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    // 1.0 * 0.95^2 = 0.9025
    expect(calculateEffectiveRelevance(1.0, twoWeeksAgo)).toBeCloseTo(0.9025, 2);
  });

  it('should have a floor of 0.1', () => {
    const longAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    expect(calculateEffectiveRelevance(1.0, longAgo)).toBeGreaterThanOrEqual(0.1);
  });
});

describe('scoreMemory', () => {
  it('should combine relevance, recency, and topic overlap', () => {
    const now = new Date();
    const score = scoreMemory(1.0, now, ['api', 'auth'], ['api', 'auth']);
    // 1.0 (effective) * 1.0 (recency) * 1.0 (overlap) = 1.0
    expect(score).toBeCloseTo(1.0, 1);
  });

  it('should return lower score for old, off-topic memories', () => {
    const longAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000); // 8 weeks
    const score = scoreMemory(1.0, longAgo, ['database'], ['api', 'auth']);
    expect(score).toBeLessThan(0.3);
  });
});
