import { describe, it, expect } from 'vitest';
import { sessionFormSchema } from '../session';

const validForm = {
  problemStatement: 'How do we improve the system architecture?',
  expertIds: ['expert-1', 'expert-2'],
  maxMessages: 30,
};

describe('sessionFormSchema', () => {
  it('valid form passes', () => {
    const result = sessionFormSchema.safeParse(validForm);
    expect(result.success).toBe(true);
  });

  it('problem statement too short fails', () => {
    const result = sessionFormSchema.safeParse({ ...validForm, problemStatement: 'Short' });
    expect(result.success).toBe(false);
  });

  it('problem statement too long fails', () => {
    const result = sessionFormSchema.safeParse({ ...validForm, problemStatement: 'a'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  it('less than 2 experts fails', () => {
    const result = sessionFormSchema.safeParse({ ...validForm, expertIds: ['expert-1'] });
    expect(result.success).toBe(false);
  });

  it('more than 10 experts fails', () => {
    const ids = Array.from({ length: 11 }, (_, i) => `expert-${i}`);
    const result = sessionFormSchema.safeParse({ ...validForm, expertIds: ids });
    expect(result.success).toBe(false);
  });

  it('maxMessages below 5 fails', () => {
    const result = sessionFormSchema.safeParse({ ...validForm, maxMessages: 4 });
    expect(result.success).toBe(false);
  });

  it('maxMessages above 200 fails', () => {
    const result = sessionFormSchema.safeParse({ ...validForm, maxMessages: 201 });
    expect(result.success).toBe(false);
  });

  it('maxMessages defaults to 30', () => {
    const result = sessionFormSchema.safeParse({
      problemStatement: validForm.problemStatement,
      expertIds: validForm.expertIds,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxMessages).toBe(30);
    }
  });

  it('non-integer maxMessages fails', () => {
    const result = sessionFormSchema.safeParse({ ...validForm, maxMessages: 10.5 });
    expect(result.success).toBe(false);
  });
});
