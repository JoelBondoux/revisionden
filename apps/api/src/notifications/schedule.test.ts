import { reminderTicksAfter } from './ticks';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMINDER_SETTINGS,
  MAX_REMINDERS_PER_DAY,
  dueReminders,
  isQuietTime,
  localClock,
  type ReminderState,
} from './schedule';

const settings = DEFAULT_REMINDER_SETTINGS;

function state(overrides: Partial<ReminderState> = {}): ReminderState {
  return {
    sentToday: [],
    practisedToday: false,
    currentStreak: 4,
    plannedSessionsToday: 1,
    ...overrides,
  };
}

describe('localClock', () => {
  it('converts UTC to London time, including summer time', () => {
    expect(localClock(new Date('2026-01-15T16:30:00Z'), 'Europe/London')).toEqual({
      date: '2026-01-15',
      time: '16:30',
      weekday: 4,
    });
    expect(localClock(new Date('2026-07-15T16:30:00Z'), 'Europe/London')).toEqual({
      date: '2026-07-15',
      time: '17:30',
      weekday: 3,
    });
  });

  it('rolls over to the next local date just after midnight', () => {
    expect(localClock(new Date('2026-07-15T23:10:00Z'), 'Europe/London').date).toBe('2026-07-16');
  });
});

describe('isQuietTime', () => {
  it('is quiet at night by default (21:00 to 07:30)', () => {
    expect(isQuietTime({ time: '21:00', weekday: 6 }, settings)).toBe(true);
    expect(isQuietTime({ time: '03:00', weekday: 6 }, settings)).toBe(true);
    expect(isQuietTime({ time: '07:29', weekday: 6 }, settings)).toBe(true);
    expect(isQuietTime({ time: '07:30', weekday: 6 }, settings)).toBe(false);
    expect(isQuietTime({ time: '20:59', weekday: 6 }, settings)).toBe(false);
  });

  it('is quiet during school hours on weekdays but not at weekends', () => {
    expect(isQuietTime({ time: '10:00', weekday: 2 }, settings)).toBe(true);
    expect(isQuietTime({ time: '15:29', weekday: 5 }, settings)).toBe(true);
    expect(isQuietTime({ time: '15:30', weekday: 5 }, settings)).toBe(false);
    expect(isQuietTime({ time: '10:00', weekday: 0 }, settings)).toBe(false);
    expect(isQuietTime({ time: '10:00', weekday: 6 }, settings)).toBe(false);
  });

  it('follows quiet hours the parent changed', () => {
    const custom = { ...settings, quietStart: '22:30', quietEnd: '06:45' };
    expect(isQuietTime({ time: '22:00', weekday: 6 }, custom)).toBe(false);
    expect(isQuietTime({ time: '22:30', weekday: 6 }, custom)).toBe(true);
    expect(isQuietTime({ time: '06:50', weekday: 6 }, custom)).toBe(false);
  });

  it('handles a quiet window that does not cross midnight', () => {
    const custom = { ...settings, quietStart: '00:00', quietEnd: '06:00' };
    expect(isQuietTime({ time: '23:00', weekday: 6 }, custom)).toBe(false);
    expect(isQuietTime({ time: '05:59', weekday: 6 }, custom)).toBe(true);
  });
});

describe('dueReminders', () => {
  const at = (iso: string) => new Date(iso);
  // 2026-01-15 is a Thursday; London is on UTC in January.

  it('sends a planned-session reminder from the session reminder time', () => {
    expect(dueReminders(at('2026-01-15T16:29:00Z'), settings, state())).toEqual([]);
    const due = dueReminders(at('2026-01-15T16:30:00Z'), settings, state());
    expect(due).toEqual([
      { kind: 'session', localDate: '2026-01-15', message: expect.stringMatching(/session/i) },
    ]);
  });

  it('sends a streak reminder in the evening when today is not done yet', () => {
    const due = dueReminders(
      at('2026-01-15T19:05:00Z'),
      settings,
      state({ sentToday: ['session'] }),
    );
    expect(due).toEqual([
      { kind: 'streak', localDate: '2026-01-15', message: expect.stringContaining('4-day') },
    ]);
  });

  it('sends nothing once the student has practised today', () => {
    expect(
      dueReminders(at('2026-01-15T19:05:00Z'), settings, state({ practisedToday: true })),
    ).toEqual([]);
  });

  it('never sends the same kind twice in a day', () => {
    expect(
      dueReminders(
        at('2026-01-15T19:05:00Z'),
        settings,
        state({ sentToday: ['session', 'streak'] }),
      ),
    ).toEqual([]);
  });

  it(`sends at most ${MAX_REMINDERS_PER_DAY} reminders a day`, () => {
    expect(MAX_REMINDERS_PER_DAY).toBe(2);
    const both = dueReminders(at('2026-01-15T19:05:00Z'), settings, state());
    expect(both.map((r) => r.kind)).toEqual(['session', 'streak']);
    const custom = { ...settings };
    expect(
      dueReminders(
        at('2026-01-15T19:05:00Z'),
        custom,
        state({ sentToday: ['session', 'session'] }),
      ),
    ).toEqual([]);
  });

  it('skips the streak reminder when there is no streak to keep', () => {
    const due = dueReminders(
      at('2026-01-15T19:05:00Z'),
      settings,
      state({ currentStreak: 0, plannedSessionsToday: 0 }),
    );
    expect(due).toEqual([]);
  });

  it('skips the session reminder on a day with nothing planned', () => {
    expect(
      dueReminders(at('2026-01-15T16:45:00Z'), settings, state({ plannedSessionsToday: 0 })),
    ).toEqual([]);
  });

  it('sends nothing during quiet hours, even when a reminder is due', () => {
    expect(dueReminders(at('2026-01-15T21:30:00Z'), settings, state())).toEqual([]);
    const lateSession = { ...settings, sessionReminderTime: '10:00' };
    expect(dueReminders(at('2026-01-15T10:15:00Z'), lateSession, state())).toEqual([]);
  });

  it('sends nothing when reminders are switched off, or one kind is switched off', () => {
    expect(
      dueReminders(at('2026-01-15T19:05:00Z'), { ...settings, enabled: false }, state()),
    ).toEqual([]);
    const noStreak = { ...settings, streakReminders: false };
    expect(dueReminders(at('2026-01-15T19:05:00Z'), noStreak, state()).map((r) => r.kind)).toEqual([
      'session',
    ]);
    const noSession = { ...settings, sessionReminders: false };
    expect(dueReminders(at('2026-01-15T19:05:00Z'), noSession, state()).map((r) => r.kind)).toEqual(
      ['streak'],
    );
  });

  it('uses singular wording for a one-day streak', () => {
    const [r] = dueReminders(
      at('2026-01-15T19:05:00Z'),
      settings,
      state({ currentStreak: 1, sentToday: ['session'] }),
    );
    expect(r!.message).toContain('1-day');
  });
});

describe('dueReminders at the last check before quiet hours', () => {
  const at = (iso: string) => new Date(iso);
  const ticksAfter = (now: Date) => reminderTicksAfter(now);
  const late = { ...settings, streakReminderTime: '20:45' };

  it('sends a 20:45 reminder at the 20:30 check in winter, as no later check can', () => {
    const now = at('2026-01-15T20:30:00Z'); // 20:30 GMT; quiet from 21:00
    const due = dueReminders(now, late, state({ sentToday: ['session'] }), ticksAfter(now));
    expect(due.map((r) => r.kind)).toEqual(['streak']);
  });

  it('sends it at the 19:30 UTC check in summer, the last one before 21:00 BST', () => {
    const now = at('2026-07-15T19:30:00Z'); // 20:30 BST; the 20:00 UTC check is 21:00 BST
    const due = dueReminders(now, late, state({ sentToday: ['session'] }), ticksAfter(now));
    expect(due.map((r) => r.kind)).toEqual(['streak']);
  });

  it('waits when a later check that day can still send it on time', () => {
    const now = at('2026-01-15T20:00:00Z'); // the 20:30 check comes next
    expect(dueReminders(now, late, state({ sentToday: ['session'] }), ticksAfter(now))).toEqual([]);
  });

  it('does not send early just because school hours start after this check', () => {
    // Thursday 08:00 GMT: the 08:30 check falls in school hours, but 16:30 checks come later.
    const now = at('2026-01-15T08:00:00Z');
    expect(dueReminders(now, settings, state(), ticksAfter(now))).toEqual([]);
  });

  it('sends a time set inside quiet hours at the last check, so it is never lost', () => {
    const now = at('2026-01-17T20:30:00Z'); // Saturday 20:30 GMT
    const inQuiet = { ...settings, sessionReminderTime: '22:00', streakReminders: false };
    expect(dueReminders(now, inQuiet, state(), ticksAfter(now)).map((r) => r.kind)).toEqual([
      'session',
    ]);
  });

  it('still respects quiet hours, the daily limit and what was already sent', () => {
    const quietNow = at('2026-01-15T21:00:00Z');
    expect(dueReminders(quietNow, late, state(), ticksAfter(quietNow))).toEqual([]);
    const now = at('2026-01-15T20:30:00Z');
    expect(
      dueReminders(now, late, state({ sentToday: ['session', 'streak'] }), ticksAfter(now)),
    ).toEqual([]);
  });

  it('keeps the old behaviour when the check times are not known', () => {
    const now = at('2026-01-15T20:30:00Z');
    expect(dueReminders(now, late, state({ sentToday: ['session'] }))).toEqual([]);
  });
});

describe('every reminder time gets sent with the production check times', () => {
  // Saturdays (no school-hours window), in winter (GMT) and summer (BST).
  const days = ['2026-01-17', '2026-07-18'];
  const times: string[] = [];
  for (let m = 7 * 60 + 30; m < 21 * 60; m += 5) {
    times.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }

  it.each(days)('on %s, each time from 07:30 to 20:55 is sent exactly once', (day) => {
    const checks = reminderTicksAfter(new Date(`${day}T00:00:00Z`)).filter((t) =>
      t.toISOString().startsWith(day),
    );
    for (const time of times) {
      const s = { ...settings, streakReminderTime: time, sessionReminders: false };
      const sent: string[] = [];
      for (const check of checks) {
        const due = dueReminders(
          check,
          s,
          state({ sentToday: sent as ReminderState['sentToday'] }),
          reminderTicksAfter(check),
        );
        sent.push(...due.map((r) => r.kind));
      }
      expect(sent, `${day} ${time}`).toEqual(['streak']);
    }
  });
});
