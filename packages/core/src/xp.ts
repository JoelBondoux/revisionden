/**
 * XP and the daily goal (see docs/PRODUCT_RULES.md "XP, streaks, skip days and gift days").
 * - XP per correct answer depends on the answer type; part marks earn part of it.
 * - Double XP on the parent's focus subject or topic that week.
 * - Gifting a day to a friend earns 20 XP.
 */
import type { ItemType } from './schemas';

export const XP_PER_CORRECT: Record<ItemType, number> = {
  flashcard: 5,
  multiple_choice: 10,
  short_answer: 15,
  numeric: 15,
  worked_maths: 20,
  extended_answer: 30,
};

export const FOCUS_XP_MULTIPLIER = 2;
export const GIFT_XP = 20;
export const DEFAULT_DAILY_GOAL_XP = 50;

export interface AnswerXpInput {
  type: ItemType;
  /** Fraction of marks, 0 to 1. */
  score: number;
  /** True when the item is on this week's parent focus. */
  focus?: boolean;
}

export function xpForAnswer({ type, score, focus = false }: AnswerXpInput): number {
  if (score < 0 || score > 1) throw new Error('Answer score must be from 0 to 1');
  const xp = Math.round(XP_PER_CORRECT[type] * score);
  return focus ? xp * FOCUS_XP_MULTIPLIER : xp;
}

export function dailyGoalMet(xpToday: number, goalXp: number = DEFAULT_DAILY_GOAL_XP): boolean {
  return xpToday >= goalXp;
}
