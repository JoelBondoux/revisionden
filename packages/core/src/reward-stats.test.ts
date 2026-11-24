import { describe, expect, it } from 'vitest';
import { SEASONS } from './catalogue';
import { MASTERED_TOPIC_PERCENT, bestRun, masteryStats, seasonProgressFor } from './reward-stats';

describe('masteryStats', () => {
  it('counts mastered topics overall and in the best subject', () => {
    const stats = masteryStats([
      { subjectId: 'maths', masteryPercent: 90 },
      { subjectId: 'maths', masteryPercent: MASTERED_TOPIC_PERCENT },
      { subjectId: 'maths', masteryPercent: 40 },
      { subjectId: 'maths', masteryPercent: 10 },
      { subjectId: 'french', masteryPercent: 85 },
    ]);
    expect(stats).toEqual({
      topicsMastered: 3,
      bestSubjectTopicsMastered: 2,
      bestSubjectMasteryPercent: 100,
    });
  });

  it('uses the share of topics mastered, rounded down, for the best subject percent', () => {
    expect(
      masteryStats([
        { subjectId: 'maths', masteryPercent: 90 },
        { subjectId: 'maths', masteryPercent: 0 },
        { subjectId: 'maths', masteryPercent: 0 },
      ]).bestSubjectMasteryPercent,
    ).toBe(33);
    expect(masteryStats([])).toEqual({
      topicsMastered: 0,
      bestSubjectTopicsMastered: 0,
      bestSubjectMasteryPercent: 0,
    });
  });
});

describe('bestRun', () => {
  it('finds the most answers right in a row', () => {
    expect(bestRun([true, true, false, true, true, true, false])).toBe(3);
    expect(bestRun([])).toBe(0);
  });
});

describe('seasonProgressFor', () => {
  const autumn2 = SEASONS.find((s) => s.id === 'autumn-2-2026')!;
  const spring2 = SEASONS.find((s) => s.id === 'spring-2-2027')!;

  it('counts right answers inside a live correct-answers season, skipping late night', () => {
    const progress = seasonProgressFor({
      now: new Date('2026-11-24T12:00:00Z'),
      correctAnswersAt: [
        new Date('2026-11-03T12:00:00Z'),
        new Date('2026-11-20T12:00:00Z'),
        new Date('2026-11-20T23:00:00Z'),
        new Date('2026-10-20T12:00:00Z'),
      ],
      goalDays: [],
    });
    expect(progress).toEqual({ [autumn2.id]: 2 });
  });

  it('counts goal days inside a live goal-days season', () => {
    const progress = seasonProgressFor({
      now: new Date('2027-03-01T12:00:00Z'),
      correctAnswersAt: [],
      goalDays: ['2027-02-22', '2027-02-25', '2027-01-10'],
    });
    expect(progress).toEqual({ [spring2.id]: 2 });
  });

  it('counts inside the re-release window a year later', () => {
    const progress = seasonProgressFor({
      now: new Date('2027-11-10T12:00:00Z'),
      correctAnswersAt: [new Date('2027-11-05T12:00:00Z'), new Date('2026-11-05T12:00:00Z')],
      goalDays: [],
    });
    expect(progress[autumn2.id]).toBe(1);
  });
});
