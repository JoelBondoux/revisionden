import { describe, expect, it } from 'vitest';
import { FamilyTagBodySchema, familyEffects } from './family-tags';

const tag = {
  name: 'Beta tester',
  colour: '#6C47F5',
  description: 'Tries new features first',
  effects: {
    betaProgramme: true,
    earlyAccess: true,
    complimentaryPremium: false,
    excludeFromMetrics: false,
  },
};

describe('family tags (O6, docs/OPERATOR_CONSOLE.md "Family tags")', () => {
  it('accepts a short name, a #rrggbb colour (stored lower case) and the four effects', () => {
    expect(FamilyTagBodySchema.parse(tag)).toEqual({ ...tag, colour: '#6c47f5' });
  });

  it('refuses long names or descriptions, bad colours and contact details in a tag', () => {
    for (const bad of [
      { ...tag, name: 'x'.repeat(41) },
      { ...tag, name: '' },
      { ...tag, description: 'x'.repeat(201) },
      { ...tag, colour: 'violet' },
      { ...tag, name: 'someone@example.com' },
      { ...tag, description: 'Call 07700 900123' },
      { ...tag, effects: { betaProgramme: true } },
    ]) {
      expect(() => FamilyTagBodySchema.parse(bad), JSON.stringify(bad)).toThrow();
    }
  });

  it("combines a family's live tags into its effects; retired tags have none", () => {
    const off = {
      betaProgramme: false,
      earlyAccess: false,
      complimentaryPremium: false,
      excludeFromMetrics: false,
    };
    expect(familyEffects([])).toEqual(off);
    expect(
      familyEffects([
        { effects: { ...off, betaProgramme: true }, retired: false },
        { effects: { ...off, excludeFromMetrics: true }, retired: false },
        { effects: { ...off, complimentaryPremium: true }, retired: true },
      ]),
    ).toEqual({ ...off, betaProgramme: true, excludeFromMetrics: true });
  });
});
