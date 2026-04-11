const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'as', 'be', 'was', 'are',
  'were', 'been', 'has', 'have', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that',
  'these', 'those', 'not', 'no', 'we', 'you', 'they', 'he', 'she',
  'its', 'his', 'her', 'our', 'your', 'their', 'what', 'which', 'who',
  'when', 'where', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'than', 'too', 'very', 'just', 'about',
  'over', 'after', 'before', 'between', 'under', 'again', 'then', 'once',
]);

/**
 * Extract meaningful keywords from text.
 * Tokenizes, lowercases, removes stopwords and short words, deduplicates.
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));

  return [...new Set(words)];
}
