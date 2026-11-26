import { describe, expect, it } from 'vitest';
import { REMINDER_CRONS } from '../crons';
import { cronTimesOfDay, reminderTicksAfter } from './ticks';

const iso = (dates: Date[]) => dates.map((d) => d.toISOString());

describe('cronTimesOfDay', () => {
  it('reads the daily schedules the reminder crons use', () => {
    expect(cronTimesOfDay('30 6 * * *')).toEqual([6 * 60 + 30]);
    expect(cronTimesOfDay('*/30 7-8 * * *')).toEqual([420, 450, 480, 510]);
    expect(cronTimesOfDay('0,45 9 * * *')).toEqual([540, 585]);
  });

  it('refuses a schedule it cannot read rather than guessing', () => {
    expect(() => cronTimesOfDay('0 9 * * 1-5')).toThrow(/Unsupported cron/);
    expect(() => cronTimesOfDay('every day')).toThrow(/Unsupported cron/);
  });

  it('reads every production reminder cron: 06:30, then every half hour 07:00 to 20:30 UTC', () => {
    const minutes = REMINDER_CRONS.flatMap(cronTimesOfDay);
    expect(minutes[0]).toBe(6 * 60 + 30);
    expect(minutes.at(-1)).toBe(20 * 60 + 30);
    expect(minutes).toHaveLength(1 + 28);
  });
});

describe('reminderTicksAfter', () => {
  it('lists the checks after now, within the next 24 hours, in order', () => {
    const ticks = reminderTicksAfter(new Date('2026-01-15T19:30:00Z'));
    expect(iso(ticks.slice(0, 3))).toEqual([
      '2026-01-15T20:00:00.000Z',
      '2026-01-15T20:30:00.000Z',
      '2026-01-16T06:30:00.000Z',
    ]);
    expect(ticks.every((t) => t.getTime() <= Date.parse('2026-01-16T19:30:00Z'))).toBe(true);
  });

  it('does not count the check that is running now', () => {
    const ticks = reminderTicksAfter(new Date('2026-01-15T20:30:00Z'));
    expect(ticks[0]!.toISOString()).toBe('2026-01-16T06:30:00.000Z');
  });
});
