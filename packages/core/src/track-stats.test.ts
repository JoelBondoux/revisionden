import { describe, expect, it } from 'vitest';
import { PRACTICE_KINDS, practiceKindsTried, weakSpotsTurnedStrong } from './track-stats';

const DAY = 86_400_000;
const start = Date.UTC(2026, 10, 1, 12);

describe('weakSpotsTurnedStrong', () => {
  it('counts a topic once it was a weak spot (after 3 answers) and later reached 80+', () => {
    const wrong = [0, 1, 2].map((i) => ({ topicId: 'a', at: start + i * 60_000, score: 0 }));
    const right = Array.from({ length: 30 }, (_, i) => ({
      topicId: 'a',
      at: start + DAY + i * 60_000,
      score: 1,
    }));
    expect(weakSpotsTurnedStrong([...wrong, ...right])).toBe(1);
  });

  it('does not count a topic that was strong from the start, or never reached 80', () => {
    const strong = Array.from({ length: 30 }, (_, i) => ({
      topicId: 'b',
      at: start + i,
      score: 1,
    }));
    const stuck = [0, 1, 2, 3].map((i) => ({ topicId: 'c', at: start + i, score: 0 }));
    expect(weakSpotsTurnedStrong([...strong, ...stuck])).toBe(0);
  });

  it('counts different topics separately, in any order', () => {
    const topic = (id: string, offset: number) => [
      ...[0, 1, 2].map((i) => ({ topicId: id, at: start + offset + i, score: 0 })),
      ...Array.from({ length: 30 }, (_, i) => ({
        topicId: id,
        at: start + offset + DAY + i,
        score: 1,
      })),
    ];
    expect(weakSpotsTurnedStrong([...topic('x', 0), ...topic('y', 5 * DAY)].reverse())).toBe(2);
  });
});

describe('practiceKindsTried', () => {
  it('counts each kind of practice the student has tried, out of 7', () => {
    expect(PRACTICE_KINDS).toHaveLength(7);
    expect(practiceKindsTried({})).toBe(0);
    expect(practiceKindsTried({ lesson: true, flashcardSession: true, planEdit: false })).toBe(2);
  });
});

describe('weak spots turned strong, at scale', () => {
  it('stays fast over a long history (only the rolling mastery window is replayed)', () => {
    const answers = Array.from({ length: 10_000 }, (_, i) => ({
      topicId: 't',
      at: i * 60_000,
      score: 0.5,
    }));
    const started = performance.now();
    expect(weakSpotsTurnedStrong(answers)).toBe(0);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
