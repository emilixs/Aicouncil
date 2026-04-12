import { extractKeywords } from './keywords';

describe('extractKeywords', () => {
  it('should extract meaningful words and lowercase them', () => {
    const result = extractKeywords('Design API Authentication for Mobile');
    expect(result).toEqual(expect.arrayContaining(['design', 'api', 'authentication', 'mobile']));
  });

  it('should remove common stopwords', () => {
    const result = extractKeywords('the quick brown fox jumps over the lazy dog');
    expect(result).not.toContain('the');
    expect(result).not.toContain('over');
    expect(result).toContain('quick');
    expect(result).toContain('brown');
    expect(result).toContain('fox');
  });

  it('should remove short words (< 3 characters)', () => {
    const result = extractKeywords('we do it on a go');
    expect(result).toHaveLength(0);
  });

  it('should handle empty string', () => {
    const result = extractKeywords('');
    expect(result).toEqual([]);
  });

  it('should deduplicate words', () => {
    const result = extractKeywords('API api Api design design');
    const apiCount = result.filter((w) => w === 'api').length;
    expect(apiCount).toBe(1);
  });

  it('should strip punctuation', () => {
    const result = extractKeywords('authentication, authorization. tokens!');
    expect(result).toContain('authentication');
    expect(result).toContain('authorization');
    expect(result).toContain('tokens');
  });
});
