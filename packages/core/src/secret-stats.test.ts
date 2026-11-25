import { describe, expect, it } from 'vitest';
import { secretStats, type SecretAnswer } from './secret-stats';

const at = (iso: string) => new Date(iso);
const answer = (iso: string, over: Partial<SecretAnswer> = {}): SecretAnswer => ({
  at: at(iso),
  correct: true,
  score: 1,
  type: 'multiple_choice',
  topicId: 't1',
  subjectId: 'maths',
  ...over,
});

describe('secretStats', () => {
  it('finds a comeback: 5 right in a row straight after 3 wrong in a row', () => {
    const wrong = (m: number) => answer(`2026-11-24T10:0${m}:00Z`, { correct: false, score: 0 });
    const right = (m: number) => answer(`2026-11-24T10:1${m}:00Z`);
    const seq = [wrong(1), wrong(2), wrong(3), right(1), right(2), right(3), right(4), right(5)];
    expect(secretStats({ answers: seq, goalDays: [], enrolledSubjects: [] }).comebackRuns).toBe(1);
    expect(
      secretStats({ answers: seq.slice(1), goalDays: [], enrolledSubjects: [] }).comebackRuns,
    ).toBe(0);
  });

  it('counts weeks where every enrolled subject was practised', () => {
    const answers = [
      answer('2026-11-23T10:00:00Z', { subjectId: 'maths' }),
      answer('2026-11-26T10:00:00Z', { subjectId: 'french' }),
      answer('2026-12-01T10:00:00Z', { subjectId: 'maths' }),
    ];
    expect(
      secretStats({ answers, goalDays: [], enrolledSubjects: ['maths', 'french'] })
        .allSubjectsWeeks,
    ).toBe(1);
    expect(secretStats({ answers, goalDays: [], enrolledSubjects: [] }).allSubjectsWeeks).toBe(0);
  });

  it('works out daily and weekly bests, distinct subjects, topics and item types', () => {
    const answers = [
      answer('2026-11-24T09:00:00Z', { topicId: 'a', subjectId: 'maths', type: 'worked_maths' }),
      answer('2026-11-24T09:05:00Z', {
        topicId: 'b',
        subjectId: 'french',
        type: 'extended_answer',
      }),
      answer('2026-11-24T09:10:00Z', { topicId: 'b', subjectId: 'physics', type: 'numeric' }),
      answer('2026-11-25T09:00:00Z', {
        topicId: 'a',
        correct: false,
        score: 0.5,
        type: 'worked_maths',
      }),
    ];
    const s = secretStats({ answers, goalDays: [], enrolledSubjects: [] });
    expect(s).toMatchObject({
      bestCorrectInDay: 3,
      bestCorrectInWeek: 3,
      bestTopicsInDay: 2,
      bestSubjectsInDay: 3,
      subjectsPractised: 3,
      bestTopicAnswers: 2,
      itemTypesAnswered: 3,
      fullMarkLongAnswers: 1,
      perfectWorkings: 1,
    });
  });

  it('never counts late-night answers', () => {
    const s = secretStats({
      answers: [answer('2026-11-24T23:30:00Z')],
      goalDays: [],
      enrolledSubjects: [],
    });
    expect(s.bestCorrectInDay).toBe(0);
    expect(s.subjectsPractised).toBe(0);
  });

  it('counts perfect weeks, full weekends and the best month of goal days', () => {
    const week = [
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ];
    const s = secretStats({
      answers: [],
      goalDays: [...week, '2026-11-28', '2026-11-29'],
      enrolledSubjects: [],
    });
    expect(s.perfectWeeks).toBe(1);
    expect(s.fullWeekends).toBe(2);
    expect(s.bestGoalDaysInMonth).toBe(9);
  });
});
