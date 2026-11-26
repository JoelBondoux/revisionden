import type { PipPose } from './PipFigure';

/** About how long Pip rests between idle actions (owner default, 2026-11-26). */
export const IDLE_GAP_MS = 8000;
/** Pip stops acting after this long without a tap or key press, so he never nags. */
export const IDLE_STOP_MS = 60_000;

const ACTIONS: readonly PipPose[] = ['blink', 'wave', 'stretch', 'read', 'timer'];
/** Study hours: outside them Pip naps instead. */
const AWAKE_FROM = 7;
const AWAKE_UNTIL = 21;

interface IdleInput {
  /** Time since the last tap or key press. */
  idleMs: number;
  /** The local hour (0 to 23). */
  hour: number;
  last: PipPose;
  random: () => number;
  /** A lesson or test: no idle motion. */
  calm: boolean;
  reducedMotion: boolean;
}

/** Pip's next idle pose and how long until the one after (null: no more for now). */
export function nextIdle(input: IdleInput): { pose: PipPose; delayMs: number | null } {
  if (input.calm || input.reducedMotion || input.idleMs > IDLE_STOP_MS) {
    return { pose: 'rest', delayMs: null };
  }
  const delayMs = Math.round(IDLE_GAP_MS - 1000 + input.random() * 2000);
  if (input.hour < AWAKE_FROM || input.hour >= AWAKE_UNTIL) return { pose: 'nap', delayMs };
  const choices = ACTIONS.filter((a) => a !== input.last);
  const pose = choices[Math.min(choices.length - 1, Math.floor(input.random() * choices.length))]!;
  return { pose, delayMs };
}
