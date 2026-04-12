import { describe, it, expect } from 'vitest';
import { COUNCIL_PRESETS } from './council-presets';
import { EXPERT_TEMPLATES } from './expert-templates';

describe('COUNCIL_PRESETS', () => {
  it('should contain exactly 6 presets', () => {
    expect(COUNCIL_PRESETS).toHaveLength(6);
  });

  it.each([
    'id',
    'name',
    'description',
    'expertTemplateIds',
  ] as const)('every preset should have a "%s" field', (field) => {
    for (const preset of COUNCIL_PRESETS) {
      expect(preset).toHaveProperty(field);
      expect(preset[field]).toBeDefined();
    }
  });

  it('every preset should have a unique id', () => {
    const ids = COUNCIL_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset should have a non-empty name', () => {
    for (const preset of COUNCIL_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
    }
  });

  it('every preset should have a non-empty description', () => {
    for (const preset of COUNCIL_PRESETS) {
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });

  it('every preset should reference at least one expert template', () => {
    for (const preset of COUNCIL_PRESETS) {
      expect(preset.expertTemplateIds.length).toBeGreaterThan(0);
    }
  });

  it('every preset should only reference valid expert template IDs', () => {
    const validIds = new Set(EXPERT_TEMPLATES.map((t) => t.id));
    for (const preset of COUNCIL_PRESETS) {
      for (const templateId of preset.expertTemplateIds) {
        expect(validIds.has(templateId)).toBe(true);
      }
    }
  });
});
