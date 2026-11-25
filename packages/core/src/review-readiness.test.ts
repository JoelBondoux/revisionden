import { describe, expect, it } from 'vitest';
import { missingChecks, readyForHumanReview } from './review-readiness';

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
