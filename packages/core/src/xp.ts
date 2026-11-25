/**
 * XP and the daily goal (see docs/PRODUCT_RULES.md "XP, streaks, skip days and gift days").
 * - XP per correct answer depends on the answer type; part marks earn part of it.
 * - Double XP on the parent's focus subject or topic that week.
 * - Gifting a day to a friend earns 20 XP.
 * - Combo bonus: +5 XP per right answer from the 3rd in a row (docs/GAME_FEEL.md).
 */
import type { ItemType } from './schemas';
import { ACTIVE_GAP_MS } from './stats';

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

// Combo bonus (docs/GAME_FEEL.md "XP rule") -----------------------------------------------

/** Extra XP for each right answer from the COMBO_BONUS_FROM-th in a row. */
export const COMBO_BONUS_XP = 5;
export const COMBO_BONUS_FROM = 3;

/** The bonus for an answer that makes a combo of `combo` right answers in a row (this one included). */
export function comboBonusXp(combo: number): number {
  return combo >= COMBO_BONUS_FROM ? COMBO_BONUS_XP : 0;
}

/** A previous answer, as far as combos care. */
/** The mode saved on a recall check answer: Learn mode, but it never breaks a combo. */
export const RECALL_MODE = 'recall';

export interface ComboAnswer {
  correct: boolean;
  mode: string | null;
  at: Date;
}

/**
 * Right Learn mode answers in a row just before an answer given at `now`, from the student's
 * history (newest first). Combos never span sessions: a gap of more than ACTIVE_GAP_MS (5 minutes,
 * the same rule as study sessions) ends one, and so does a wrong answer or an answer in Test mode.
 */
export function comboBefore(history: readonly ComboAnswer[], now: Date): number {
  let combo = 0;
  let later = now.getTime();
  for (const answer of history) {
    const at = answer.at.getTime();
    if (later - at > ACTIVE_GAP_MS) break;
    later = at;
    // Recall checks (Q4) feel safe: a wrong one is passed over; a right one still counts.
    if (answer.mode === RECALL_MODE && !answer.correct) continue;
    if ((answer.mode !== 'learn' && answer.mode !== RECALL_MODE) || !answer.correct) break;
    combo += 1;
  }
  return combo;
}

export interface SequenceComboBonus {
  /** The bonus for each answer, in order. */
  bonuses: number[];
  bonusXp: number;
  bestCombo: number;
}

/** Test mode: the combo bonus for answers in the order given, applied at the reveal. */
export function comboBonusForSequence(corrects: readonly boolean[]): SequenceComboBonus {
  let combo = 0;
  let bestCombo = 0;
  const bonuses = corrects.map((correct) => {
    combo = correct ? combo + 1 : 0;
    bestCombo = Math.max(bestCombo, combo);
    return comboBonusXp(combo);
  });
  return { bonuses, bonusXp: bonuses.reduce((a, b) => a + b, 0), bestCombo };
}
