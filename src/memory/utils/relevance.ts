const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Recency boost: 1.0 for today, decays 0.1 per week, floor 0.3.
 */
export function calculateRecencyBoost(createdAt: Date): number {
  const weeksSince = (Date.now() - createdAt.getTime()) / MS_PER_WEEK;
  return Math.max(0.3, 1.0 - weeksSince * 0.1);
}

/**
 * Topic overlap: Jaccard similarity with floor of 0.2.
 */
export function calculateTopicOverlap(memoryTopics: string[], queryTopics: string[]): number {
  if (memoryTopics.length === 0 || queryTopics.length === 0) {
    return 0.2;
  }

  const setA = new Set(memoryTopics);
  const setB = new Set(queryTopics);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  const jaccard = intersection.size / union.size;
  return Math.max(0.2, jaccard);
}

/**
 * Effective relevance: base relevance decayed by time.
 * Formula: baseRelevance * 0.95^weeksSinceCreation, floor 0.1.
 */
export function calculateEffectiveRelevance(baseRelevance: number, createdAt: Date): number {
  const weeksSince = (Date.now() - createdAt.getTime()) / MS_PER_WEEK;
  return Math.max(0.1, baseRelevance * Math.pow(0.95, weeksSince));
}

/**
 * Combined memory score: effectiveRelevance * recencyBoost * topicOverlap.
 */
export function scoreMemory(
  baseRelevance: number,
  createdAt: Date,
  memoryTopics: string[],
  queryTopics: string[],
): number {
  const effective = calculateEffectiveRelevance(baseRelevance, createdAt);
  const recency = calculateRecencyBoost(createdAt);
  const overlap = calculateTopicOverlap(memoryTopics, queryTopics);
  return effective * recency * overlap;
}
