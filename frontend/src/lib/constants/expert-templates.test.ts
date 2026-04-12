import { describe, it, expect } from 'vitest';
import { EXPERT_TEMPLATES } from './expert-templates';
import { DriverType } from '@/types/expert';

describe('EXPERT_TEMPLATES', () => {
  it('should contain exactly 14 templates', () => {
    expect(EXPERT_TEMPLATES).toHaveLength(14);
  });

  it.each([
    'id',
    'name',
    'specialty',
    'systemPrompt',
    'driverType',
    'config',
  ] as const)('every template should have a "%s" field', (field) => {
    for (const template of EXPERT_TEMPLATES) {
      expect(template).toHaveProperty(field);
      expect(template[field]).toBeDefined();
    }
  });

  it('every template should have a unique id', () => {
    const ids = EXPERT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template should have a non-empty name', () => {
    for (const template of EXPERT_TEMPLATES) {
      expect(template.name.length).toBeGreaterThan(0);
    }
  });

  it('every template should have a valid driverType', () => {
    const validTypes = Object.values(DriverType);
    for (const template of EXPERT_TEMPLATES) {
      expect(validTypes).toContain(template.driverType);
    }
  });

  it('every template config should have a model field', () => {
    for (const template of EXPERT_TEMPLATES) {
      expect(template.config).toHaveProperty('model');
      expect(typeof template.config.model).toBe('string');
      expect(template.config.model.length).toBeGreaterThan(0);
    }
  });

  it('every template should have a systemPrompt of at least 10 characters', () => {
    for (const template of EXPERT_TEMPLATES) {
      expect(template.systemPrompt.length).toBeGreaterThanOrEqual(10);
    }
  });
});
