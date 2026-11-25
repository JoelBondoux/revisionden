import { describe, expect, it } from 'vitest';
import {
  missingChecks,
  needsIndividualReview,
  readyForHumanReview,
  recheckedSince,
} from './review-readiness';

const check = (name: string, result = 'pass') => ({ name, result });
const automated = [
  'grounded-writing',
  'quote-check',
  'blind-answer',
  'adversarial-review',
  'schema',
];

describe('readyForHumanReview', () => {
  it('accepts a draft whose automated checks all passed', () => {
    const item = {
      type: 'short_answer',
      verification: { status: 'draft', checks: automated.map((n) => check(n)) },
    };
    expect(readyForHumanReview(item)).toBe(true);
    expect(missingChecks(item)).toEqual([]);
  });

  it('needs the maths engine for numeric and worked maths items', () => {
    const item = {
      type: 'numeric',
      verification: { status: 'draft', checks: automated.map((n) => check(n)) },
    };
    expect(missingChecks(item)).toEqual(['maths-engine']);
    item.verification.checks.push(check('maths-engine'));
    expect(readyForHumanReview(item)).toBe(true);
  });

  it('needs blind marking, not a blind answer, for extended answers', () => {
    const names = automated.filter((n) => n !== 'blind-answer');
    const item = {
      type: 'extended_answer',
      verification: { status: 'draft', checks: [...names, 'blind-answer'].map((n) => check(n)) },
    };
    expect(missingChecks(item)).toEqual(['blind-marking']);
  });

  it('refuses an item with a failed or missing check', () => {
    const checks = automated.map((n) => check(n, n === 'quote-check' ? 'fail' : 'pass'));
    const item = { type: 'flashcard', verification: { status: 'draft', checks } };
    expect(missingChecks(item)).toEqual(['quote-check']);
    expect(readyForHumanReview({ type: 'flashcard', verification: { status: 'draft' } })).toBe(
      false,
    );
  });

  it('only offers drafts', () => {
    const item = {
      type: 'short_answer',
      verification: { status: 'verified', checks: automated.map((n) => check(n)) },
    };
    expect(readyForHumanReview(item)).toBe(false);
  });

  it('refuses something that is not an item record', () => {
    expect(readyForHumanReview(null)).toBe(false);
    expect(readyForHumanReview({ type: 'numeric' })).toBe(false);
  });
});

describe('items resting on standard facts (decision 0009)', () => {
  const base = automated.map((n) => check(n));
  const withFacts = (checks: { name: string; result: string }[]) => ({
    type: 'short_answer',
    facts: [{ statement: 'Fixture fact.', ask: 'Fixture?' }],
    verification: { status: 'draft', checks },
  });

  it('needs a fact-check before human review', () => {
    expect(missingChecks(withFacts(base))).toEqual(['fact-check']);
    expect(readyForHumanReview(withFacts(base))).toBe(false);
  });

  it('goes to normal review when the fact-check passed', () => {
    const item = withFacts([...base, check('fact-check')]);
    expect(readyForHumanReview(item)).toBe(true);
    expect(needsIndividualReview(item)).toBe(false);
  });

  it('still goes to review when the fact-check failed, but always individually', () => {
    const item = withFacts([...base, check('fact-check', 'fail')]);
    expect(readyForHumanReview(item)).toBe(true);
    expect(needsIndividualReview(item)).toBe(true);
  });

  it('marks needs_human_approval items for individual review', () => {
    expect(needsIndividualReview({ needs_human_approval: true })).toBe(true);
    expect(needsIndividualReview({ type: 'short_answer' })).toBe(false);
  });
});

describe('exact checks the item declares', () => {
  it('needs units, chemical-equation and equation-sheet checks when its exact block names them', () => {
    const item = {
      type: 'short_answer',
      exact: {
        quantity: 'x',
        chemical_equation: 'y',
        equation_sheet: { sheet: 's', equation: 'e' },
      },
      verification: { status: 'draft', checks: automated.map((n) => check(n)) },
    };
    expect(missingChecks(item)).toEqual(['units', 'chemical-equation', 'equation-sheet']);
    item.verification.checks.push(check('units'), check('chemical-equation', 'fail'));
    expect(missingChecks(item)).toEqual(['chemical-equation', 'equation-sheet']);
  });
});

describe('rechecked since a failed batch', () => {
  const at = (name: string, when: string) => ({ name, result: 'pass', at: when });
  const record = (checks: { name: string; result: string; at: string }[]) => ({
    type: 'numeric',
    verification: { status: 'draft', checks },
  });
  const failedAt = new Date('2026-11-25T12:00:00Z');

  it('is fresh only when every step 3 to 5 check ran after the batch failed', () => {
    const fresh = record([
      at('quote-check', '2026-11-20T00:00:00Z'),
      at('blind-answer', '2026-11-25T13:00:00Z'),
      at('adversarial-review', '2026-11-25T13:01:00Z'),
      at('maths-engine', '2026-11-25T13:02:00Z'),
    ]);
    expect(recheckedSince(fresh, failedAt)).toBe(true);
    const stale = record([
      at('blind-answer', '2026-11-25T13:00:00Z'),
      at('adversarial-review', '2026-11-24T09:00:00Z'),
    ]);
    expect(recheckedSince(stale, failedAt)).toBe(false);
  });

  it('is not fresh with no step 3 to 5 checks or an unreadable time', () => {
    expect(recheckedSince(record([at('quote-check', '2026-11-26T00:00:00Z')]), failedAt)).toBe(
      false,
    );
    expect(recheckedSince(record([at('blind-answer', 'not a time')]), failedAt)).toBe(false);
  });
});
