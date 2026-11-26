/**
 * When the reminder checks run (the production cron schedules in ../crons.ts, all UTC). The
 * reminder rules use this to spot the last check before quiet hours, so a reminder set for a
 * time no later check can reach still gets sent (schedule.ts).
 */
import { REMINDER_CRONS } from '../crons';

const DAY_MS = 24 * 60 * 60 * 1000;

function field(text: string, max: number): number[] | null {
  const step = /^\*\/(\d+)$/.exec(text);
  if (step) {
    const n = Number(step[1]);
    return n > 0 ? Array.from({ length: Math.ceil((max + 1) / n) }, (_, i) => i * n) : null;
  }
  const range = /^(\d+)-(\d+)$/.exec(text);
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])];
    return a <= b && b <= max ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : null;
  }
  if (/^\d+(,\d+)*$/.test(text)) {
    const values = text.split(',').map(Number);
    return values.every((v) => v <= max) ? values : null;
  }
  return null;
}

/**
 * Minutes after midnight (UTC) at which a daily cron runs. Only the simple daily forms the
 * reminder crons use are read ("M H * * *" with lists, ranges or steps); anything else throws,
 * so a new schedule cannot be silently misread.
 */
export function cronTimesOfDay(cron: string): number[] {
  const parts = cron.trim().split(/\s+/);
  const minutes = parts.length === 5 ? field(parts[0]!, 59) : null;
  const hours = parts.length === 5 ? field(parts[1]!, 23) : null;
  if (!minutes || !hours || parts.slice(2).some((p) => p !== '*')) {
    throw new Error(`Unsupported cron for reminder checks: ${cron}`);
  }
  return hours.flatMap((h) => minutes.map((m) => h * 60 + m)).sort((a, b) => a - b);
}

/** The reminder checks after `now` (not counting one at `now` itself), up to 24 hours ahead. */
export function reminderTicksAfter(now: Date, crons: readonly string[] = REMINDER_CRONS): Date[] {
  const minutes = [...new Set(crons.flatMap(cronTimesOfDay))].sort((a, b) => a - b);
  const startOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = now.getTime() + DAY_MS;
  return [0, 1]
    .flatMap((day) => minutes.map((m) => startOfDay + day * DAY_MS + m * 60_000))
    .filter((t) => t > now.getTime() && t <= end)
    .map((t) => new Date(t));
}
