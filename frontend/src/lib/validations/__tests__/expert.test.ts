import { describe, it, expect } from 'vitest';
import { expertFormSchema } from '../expert';
import { DriverType } from '@/types';

const validForm = {
  name: 'Test Expert',
  specialty: 'Software Engineering',
  systemPrompt: 'You are a helpful expert assistant.',
  driverType: DriverType.OPENAI,
  config: {
    model: 'gpt-4',
  },
};

describe('expertFormSchema', () => {
  it('valid complete form passes', () => {
    const result = expertFormSchema.safeParse(validForm);
    expect(result.success).toBe(true);
  });

  it('missing name fails', () => {
    const result = expertFormSchema.safeParse({ ...validForm, name: '' });
    expect(result.success).toBe(false);
  });

  it('name too long fails', () => {
    const result = expertFormSchema.safeParse({ ...validForm, name: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('missing specialty fails', () => {
    const result = expertFormSchema.safeParse({ ...validForm, specialty: '' });
    expect(result.success).toBe(false);
  });

  it('system prompt too short fails', () => {
    const result = expertFormSchema.safeParse({ ...validForm, systemPrompt: 'short' });
    expect(result.success).toBe(false);
  });

  it('system prompt too long fails', () => {
    const result = expertFormSchema.safeParse({ ...validForm, systemPrompt: 'a'.repeat(5001) });
    expect(result.success).toBe(false);
  });

  it('missing model in config fails', () => {
    const result = expertFormSchema.safeParse({ ...validForm, config: { model: '' } });
    expect(result.success).toBe(false);
  });

  it('temperature above 2 fails', () => {
    const result = expertFormSchema.safeParse({ ...validForm, config: { model: 'gpt-4', temperature: 2.1 } });
    expect(result.success).toBe(false);
  });

  it('temperature below 0 fails', () => {
    const result = expertFormSchema.safeParse({ ...validForm, config: { model: 'gpt-4', temperature: -0.1 } });
    expect(result.success).toBe(false);
  });

  it('valid optional fields pass', () => {
    const result = expertFormSchema.safeParse({
      ...validForm,
      config: {
        model: 'gpt-4',
        temperature: 1.0,
        maxTokens: 1000,
        topP: 0.9,
        stop: ['END'],
      },
    });
    expect(result.success).toBe(true);
  });

  it('ANTHROPIC driver type passes', () => {
    const result = expertFormSchema.safeParse({ ...validForm, driverType: DriverType.ANTHROPIC });
    expect(result.success).toBe(true);
  });

  it('GROK driver type passes', () => {
    const result = expertFormSchema.safeParse({ ...validForm, driverType: DriverType.GROK });
    expect(result.success).toBe(true);
  });
});
