import { describe, expect, it } from 'vitest';
import { LearnItemSchema } from '../learning-schemas';
import { EXPECTED_SECONDS } from '../mistakes';
import { ItemTypeSchema } from '../schemas';
import { XP_PER_CORRECT } from '../xp';

const item = {
  id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  topicId: 'gcse-maths-h-a4',
  topicTitle: 'Simplifying, expanding and factorising',
  draft: true,
  type: 'area_model',
  mode: 'explore',
  prompt: 'Make x^2 + 5x + 6 into a rectangle.',
  quadratic: { b: 5, c: 6 },
};

describe('the area model item type (lesson pilot W8)', () => {
  it('is a known item type', () => {
    expect(ItemTypeSchema.parse('area_model')).toBe('area_model');
  });

  it('reaches the student with its prompt, mode and quadratic, and never its answer', () => {
    const parsed = LearnItemSchema.parse({ ...item, answer: { pair: [2, 3] } });
    expect(parsed).toEqual(item);
  });

  it('refuses a mode it does not know and numbers outside the pilot', () => {
    expect(LearnItemSchema.safeParse({ ...item, mode: 'free-play' }).success).toBe(false);
    expect(LearnItemSchema.safeParse({ ...item, quadratic: { b: 1, c: -6 } }).success).toBe(false);
  });

  it('earns the same XP as choosing an answer, and expects about a minute', () => {
    expect(XP_PER_CORRECT.area_model).toBe(XP_PER_CORRECT.multiple_choice);
    expect(EXPECTED_SECONDS.area_model).toBe(60);
  });
});
