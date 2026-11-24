/**
 * Small builders that turn stored learning records into reward stats (see rewards.ts). Pure
 * functions; the API loads the records and passes them in.
 */
import { SEASONS, type RewardStats, type Season } from './catalogue';
import { localDate } from './learning';
import { isLateNight } from './reward-xp';

/** A topic counts as mastered at 80% (the same line that unlocks a unit challenge). */
export const MASTERED_TOPIC_PERCENT = 80;

export function masteryStats(
  topics: readonly { subjectId: string; masteryPercent: number }[],
): Pick<RewardStats, 'topicsMastered' | 'bestSubjectTopicsMastered' | 'bestSubjectMasteryPercent'> {
  const bySubject = new Map<string, { mastered: number; total: number }>();
  for (const t of topics) {
    const s = bySubject.get(t.subjectId) ?? { mastered: 0, total: 0 };
    s.total += 1;
    if (t.masteryPercent >= MASTERED_TOPIC_PERCENT) s.mastered += 1;
    bySubject.set(t.subjectId, s);
  }
  const subjects = [...bySubject.values()];
  return {
    topicsMastered: subjects.reduce((sum, s) => sum + s.mastered, 0),
    bestSubjectTopicsMastered: Math.max(0, ...subjects.map((s) => s.mastered)),
    bestSubjectMasteryPercent: Math.max(
      0,
      ...subjects.map((s) => Math.floor((s.mastered / s.total) * 100)),
    ),
  };
}

/** Most answers right in a row, from answers in the order they were given. */
export function bestRun(correct: readonly boolean[]): number {
  let best = 0;
  let run = 0;
  for (const c of correct) {
    run = c ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** The live window of a season today: its term, or its re-release a year later. */
function liveWindow(season: Season, today: string) {
  return [season.window, season.rerelease].find((w) => today >= w.start && today <= w.end);
}

/**
 * Challenge progress for every season live today, counted inside the live window only. Right
 * answers given late at night do not count, like all reward progress.
 */
export function seasonProgressFor(input: {
  now: Date;
  correctAnswersAt: readonly Date[];
  /** UK dates on which the daily goal was met. */
  goalDays: readonly string[];
  seasons?: readonly Season[];
}): Record<string, number> {
  const today = localDate(input.now);
  const progress: Record<string, number> = {};
  for (const season of input.seasons ?? SEASONS) {
    const w = liveWindow(season, today);
    if (!w) continue;
    const inside = (day: string) => day >= w.start && day <= w.end;
    progress[season.id] =
      season.measure === 'goalDays'
        ? input.goalDays.filter(inside).length
        : input.correctAnswersAt.filter((at) => !isLateNight(at) && inside(localDate(at))).length;
  }
  return progress;
}
