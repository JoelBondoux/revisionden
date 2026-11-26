/**
 * Topic mastery from 0 to 100 (see docs/PLAN.md "Mastery and weak spots").
 *
 * A weighted average of the most recent 30 attempt scores, where each attempt's weight halves
 * every 30 days. Two imaginary wrong answers act as a starting point, so mastery has to be
 * earned with evidence and slowly drifts down when a topic is not practised.
 */
import { DAY_MS } from './spaced-repetition';

export interface MasteryAttempt {
  /** Fraction of marks, 0 to 1 (1 for a correct answer, 0 for a wrong one). */
  score: number;
  /** Milliseconds since the epoch. */
  at: number;
  /** How much the attempt counts (1 by default; a retry in a lesson counts 0.5, RETRY_WEIGHT). */
  weight?: number;
}

export const WEAK_SPOT_THRESHOLD = 60;
export const MASTERY_WINDOW = 30;
export const MASTERY_HALF_LIFE_DAYS = 30;
const PRIOR_WEIGHT = 2;
const PRIOR_SCORE = 0;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function topicMastery(attempts: readonly MasteryAttempt[], now: number): number {
  const recent = [...attempts].sort((a, b) => b.at - a.at).slice(0, MASTERY_WINDOW);
  let weighted = PRIOR_WEIGHT * PRIOR_SCORE;
  let totalWeight = PRIOR_WEIGHT;
  for (const attempt of recent) {
    const ageDays = Math.max(0, now - attempt.at) / DAY_MS;
    const weight = (attempt.weight ?? 1) * 0.5 ** (ageDays / MASTERY_HALF_LIFE_DAYS);
    weighted += weight * clamp(attempt.score, 0, 1);
    totalWeight += weight;
  }
  return clamp(Math.round((100 * weighted) / totalWeight), 0, 100);
}

export function isWeakSpot(mastery: number): boolean {
  return mastery < WEAK_SPOT_THRESHOLD;
}
