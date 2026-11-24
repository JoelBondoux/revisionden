import { describe, expect, it } from 'vitest';
import { nextFeedbackLevel } from './feedback-level';

// Boundaries are last summer's grade boundaries, as a percentage of marks.
const boundaries = { target: 70, oneBelowTarget: 58 };

describe('nextFeedbackLevel', () => {
  it('moves up when the average of the last 3 sets beats the target boundary', () => {
    expect(nextFeedbackLevel({ current: 2, recentSetScores: [72, 80, 75], ...boundaries })).toBe(3);
  });

  it('needs at least 3 sets before moving up', () => {
    expect(nextFeedbackLevel({ current: 2, recentSetScores: [100, 100], ...boundaries })).toBe(2);
  });

  it('only looks at the most recent 3 sets', () => {
    expect(
      nextFeedbackLevel({ current: 1, recentSetScores: [10, 90, 90, 90], ...boundaries }),
    ).toBe(2);
  });

  it('moves down when the average falls below the boundary one grade under target', () => {
    expect(nextFeedbackLevel({ current: 3, recentSetScores: [50, 55, 60], ...boundaries })).toBe(2);
  });

  it('stays put between the two boundaries', () => {
    expect(nextFeedbackLevel({ current: 2, recentSetScores: [60, 65, 68], ...boundaries })).toBe(2);
  });

  it('never goes above level 4 or below level 1', () => {
    expect(nextFeedbackLevel({ current: 4, recentSetScores: [99, 99, 99], ...boundaries })).toBe(4);
    expect(nextFeedbackLevel({ current: 1, recentSetScores: [0, 0, 0], ...boundaries })).toBe(1);
  });

  it('can move down with fewer than 3 sets if the student is clearly struggling', () => {
    expect(nextFeedbackLevel({ current: 3, recentSetScores: [20], ...boundaries })).toBe(2);
  });

  it('rejects boundaries in the wrong order', () => {
    expect(() =>
      nextFeedbackLevel({ current: 2, recentSetScores: [70], target: 50, oneBelowTarget: 60 }),
    ).toThrow(/boundar/);
  });
});
