const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

export function calculateRecencyBoost(createdAt: Date): number {
  const weeksAgo = (Date.now() - createdAt.getTime()) / MS_PER_WEEK;
  const boost = 1.0 - weeksAgo * 0.1;
  return Math.max(boost, 0.3);
}

export function calculateTopicOverlap(
  memoryTopics: string[],
  queryTopics: string[],
): number {
  if (memoryTopics.length === 0 || queryTopics.length === 0) return 0.2;

  const setA = new Set(memoryTopics);
  const setB = new Set(queryTopics);

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  const jaccard = intersection / union;

  return Math.max(jaccard, 0.2);
}

export function calculateEffectiveRelevance(
  baseRelevance: number,
  createdAt: Date,
): number {
  const weeksAgo = (Date.now() - createdAt.getTime()) / MS_PER_WEEK;
  const decayed = baseRelevance * Math.pow(0.95, weeksAgo);
  return Math.max(decayed, 0.1);
}

export function scoreMemory(
  baseRelevance: number,
  createdAt: Date,
  memoryTopics: string[],
  queryTopics: string[],
): number {
  const recency = calculateRecencyBoost(createdAt);
  const overlap = calculateTopicOverlap(memoryTopics, queryTopics);
  return baseRelevance * recency * overlap;
}
