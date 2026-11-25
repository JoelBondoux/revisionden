/**
 * Pure game-feel rules (docs/GAME_FEEL.md). Randomness is injected so effects are repeatable in
 * tests; components pass Math.random.
 */

import { DAILY_REWARD_XP_CAP, type Progress } from '@revisionden/core';

export type Random = () => number;

/** Particles per burst are capped so a burst stays cheap on a mid-range phone. */
export const MAX_PARTICLES = 24;
/** Confetti pieces are capped for the same reason. */
export const MAX_CONFETTI = 40;
/** The neon accents particles and confetti cycle through (index into `--arena-spark-n`). */
export const SPARK_COLOURS = 4;

export interface Particle {
  /** Where the particle ends up, in px from the burst centre. */
  dx: number;
  dy: number;
  /** Size in px. */
  size: number;
  /** Which spark colour (0 to SPARK_COLOURS - 1). */
  colour: number;
}

/** A ring of particles flying out from the centre, about 20 by default and never above the cap. */
export function burstParticles(count = 20, random: Random = Math.random): Particle[] {
  const n = Math.max(0, Math.min(Math.round(count), MAX_PARTICLES));
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 + (random() - 0.5) * 0.6;
    const distance = 40 + random() * 50;
    return {
      dx: Math.round(Math.cos(angle) * distance),
      dy: Math.round(Math.sin(angle) * distance),
      size: 6 + Math.round(random() * 6),
      colour: i % SPARK_COLOURS,
    };
  });
}

export interface ConfettiPiece {
  /** Horizontal start, as a percentage of the width. */
  left: number;
  delayMs: number;
  /** Final rotation in degrees. */
  spin: number;
  /** Sideways drift in px while falling. */
  drift: number;
  colour: number;
}

/** Confetti falling from above the screen, capped. */
export function confettiPieces(
  count = MAX_CONFETTI,
  random: Random = Math.random,
): ConfettiPiece[] {
  const n = Math.max(0, Math.min(Math.round(count), MAX_CONFETTI));
  return Array.from({ length: n }, (_, i) => ({
    left: Math.round(random() * 100),
    delayMs: Math.round(random() * 600),
    spin: Math.round((random() - 0.5) * 720),
    drift: Math.round((random() - 0.5) * 80),
    colour: i % SPARK_COLOURS,
  }));
}

/** Stars for a finished set: 3 for all right, 2 for at least 60% (3–4 of 5), otherwise 1. */
export function starsForSet(correct: number, total: number): 1 | 2 | 3 {
  if (total > 0 && correct >= total) return 3;
  if (total > 0 && correct / total >= 0.6) return 2;
  return 1;
}

/** Right answers in a row. A wrong answer quietly resets it. */
export function nextCombo(current: number, correct: boolean): number {
  return correct ? current + 1 : 0;
}

/** The "COMBO ×n" badge shows from 2 right in a row. */
export function showsComboBadge(combo: number): boolean {
  return combo >= 2;
}

/** How many steps the correct chime rises for a combo (up to 6). */
export function comboStep(combo: number): number {
  return Math.max(0, Math.min(combo, 6));
}

/** Pip's short line for the current question. Always encouraging; never a fail word. */
export function pipLine({
  index,
  total,
  combo,
}: {
  index: number;
  total: number;
  combo: number;
}): string {
  if (total > 1 && index === total - 1) return 'Last one. Finish strong!';
  if (showsComboBadge(combo)) return `${combo} in a row! Keep it going.`;
  if (index === 0) return "Warm-up! Let's go.";
  return 'Nice and steady. You’ve got this.';
}

/** Ease-out cubic: fast at first, settling gently. */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** The counter's value part-way (t from 0 to 1) through rolling from one total to another. */
export function rollValue(from: number, to: number, t: number): number {
  const p = Math.min(Math.max(t, 0), 1);
  return Math.round(from + (to - from) * easeOut(p));
}

/**
 * True once today's daily limit in minutes is reached (workstream K7), or, as a safety net, once
 * today's XP reaches the daily reward cap (`DAILY_REWARD_XP_CAP`). The set-complete call to action
 * then says "See you tomorrow" instead of offering another mission.
 */
export function pastDailyCap(progress: Pick<Progress, 'xpToday' | 'dailyLimit'>): boolean {
  return progress.dailyLimit?.reached === true || progress.xpToday >= DAILY_REWARD_XP_CAP;
}
