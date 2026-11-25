/**
 * Stats for secret achievements, from stored answers and goal days (see docs/REWARDS.md "Secret
 * achievements"). Pure: the API loads the records and passes them in. Late-night answers never
 * count, like all reward progress; nothing here measures time spent or time of day.
 */
import type { RewardStats } from './catalogue';
import { localDate, weekStartOf } from './learning';
import { isLateNight } from './reward-xp';
import type { ItemType } from './schemas';

export interface SecretAnswer {
  at: Date;
  correct: boolean;
  /** Fraction of marks, 0 to 1 (null when not marked). */
  score: number | null;
  type: ItemType;
  topicId: string;
  subjectId: string;
}

export type SecretStats = Pick<
  RewardStats,
  | 'comebackRuns'
  | 'allSubjectsWeeks'
  | 'bestCorrectInDay'
  | 'bestCorrectInWeek'
  | 'bestTopicsInDay'
  | 'bestSubjectsInDay'
  | 'subjectsPractised'
  | 'bestTopicAnswers'
  | 'itemTypesAnswered'
  | 'fullMarkLongAnswers'
  | 'perfectWorkings'
  | 'fullWeekends'
  | 'perfectWeeks'
  | 'bestGoalDaysInMonth'
>;

const COMEBACK_WRONG = 3;
const COMEBACK_RIGHT = 5;

function countComebacks(answers: readonly SecretAnswer[]): number {
  let wrongRun = 0;
  let armed = false;
  let rightRun = 0;
  let comebacks = 0;
  for (const a of answers) {
    if (!a.correct) {
      wrongRun += 1;
      rightRun = 0;
      armed = wrongRun >= COMEBACK_WRONG;
      continue;
    }
    wrongRun = 0;
    if (!armed) continue;
    rightRun += 1;
    if (rightRun === COMEBACK_RIGHT) {
      comebacks += 1;
      armed = false;
      rightRun = 0;
    }
  }
  return comebacks;
}

const maxOf = (values: Iterable<number>) => Math.max(0, ...values);

function groupSets<K>(
  answers: readonly SecretAnswer[],
  key: (a: SecretAnswer) => K,
  value: (a: SecretAnswer) => string,
) {
  const groups = new Map<K, Set<string>>();
  for (const a of answers) {
    const k = key(a);
    const set = groups.get(k) ?? new Set<string>();
    set.add(value(a));
    groups.set(k, set);
  }
  return groups;
}

function countBy<K>(items: readonly SecretAnswer[], key: (a: SecretAnswer) => K) {
  const counts = new Map<K, number>();
  for (const a of items) counts.set(key(a), (counts.get(key(a)) ?? 0) + 1);
  return counts;
}

const dayOfWeek = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();

function goalDayStats(goalDays: readonly string[]) {
  const days = new Set(goalDays);
  const weeks = new Map<string, number>();
  const months = new Map<string, number>();
  let fullWeekends = 0;
  for (const day of days) {
    const week = weekStartOf(day);
    weeks.set(week, (weeks.get(week) ?? 0) + 1);
    months.set(day.slice(0, 7), (months.get(day.slice(0, 7)) ?? 0) + 1);
    if (dayOfWeek(day) === 6) {
      const sunday = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000)
        .toISOString()
        .slice(0, 10);
      if (days.has(sunday)) fullWeekends += 1;
    }
  }
  return {
    perfectWeeks: [...weeks.values()].filter((n) => n === 7).length,
    fullWeekends,
    bestGoalDaysInMonth: maxOf(months.values()),
  };
}

export function secretStats(input: {
  /** Answers in the order they were given. */
  answers: readonly SecretAnswer[];
  /** UK dates on which the daily goal was met. */
  goalDays: readonly string[];
  enrolledSubjects: readonly string[];
}): SecretStats {
  const daytime = input.answers.filter((a) => !isLateNight(a.at));
  const correct = daytime.filter((a) => a.correct);
  const day = (a: SecretAnswer) => localDate(a.at);
  const week = (a: SecretAnswer) => weekStartOf(day(a));

  const enrolled = new Set(input.enrolledSubjects);
  const subjectsByWeek = groupSets(daytime, week, (a) => a.subjectId);
  const allSubjectsWeeks =
    enrolled.size === 0
      ? 0
      : [...subjectsByWeek.values()].filter((set) => [...enrolled].every((s) => set.has(s))).length;

  return {
    comebackRuns: countComebacks(daytime),
    allSubjectsWeeks,
    bestCorrectInDay: maxOf(countBy(correct, day).values()),
    bestCorrectInWeek: maxOf(countBy(correct, week).values()),
    bestTopicsInDay: maxOf(
      [...groupSets(daytime, day, (a) => a.topicId).values()].map((s) => s.size),
    ),
    bestSubjectsInDay: maxOf(
      [...groupSets(daytime, day, (a) => a.subjectId).values()].map((s) => s.size),
    ),
    subjectsPractised: new Set(daytime.map((a) => a.subjectId)).size,
    bestTopicAnswers: maxOf(countBy(daytime, (a) => a.topicId).values()),
    itemTypesAnswered: new Set(correct.map((a) => a.type)).size,
    fullMarkLongAnswers: daytime.filter((a) => a.type === 'extended_answer' && a.score === 1)
      .length,
    perfectWorkings: daytime.filter((a) => a.type === 'worked_maths' && a.score === 1).length,
    ...goalDayStats(input.goalDays),
  };
}
