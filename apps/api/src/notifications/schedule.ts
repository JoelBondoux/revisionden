/**
 * Reminder rules (pure; time is passed in). The cron trigger asks, for each student, which
 * reminders are due now. Quiet hours always win, each kind goes at most once a local day, and
 * no student gets more than MAX_REMINDERS_PER_DAY reminders in a day.
 */

export const MAX_REMINDERS_PER_DAY = 2;

export type ReminderKind = 'session' | 'streak';

export interface ReminderSettings {
  enabled: boolean;
  streakReminders: boolean;
  sessionReminders: boolean;
  /** Nightly quiet hours, local "HH:MM". The window may cross midnight. */
  quietStart: string;
  quietEnd: string;
  /** Extra quiet window on weekdays (school hours by default). */
  weekdayQuietStart: string;
  weekdayQuietEnd: string;
  sessionReminderTime: string;
  streakReminderTime: string;
  timeZone: string;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  streakReminders: true,
  sessionReminders: true,
  quietStart: '21:00',
  quietEnd: '07:30',
  weekdayQuietStart: '08:30',
  weekdayQuietEnd: '15:30',
  sessionReminderTime: '16:30',
  streakReminderTime: '19:00',
  timeZone: 'Europe/London',
};

export interface ReminderState {
  /** Kinds already sent today (local date). */
  sentToday: ReminderKind[];
  practisedToday: boolean;
  currentStreak: number;
  plannedSessionsToday: number;
}

export interface DueReminder {
  kind: ReminderKind;
  localDate: string;
  message: string;
}

export interface LocalClock {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour */
  time: string;
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The local date, time and weekday for an instant in an IANA time zone. */
export function localClock(now: Date, timeZone: string): LocalClock {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: WEEKDAYS.indexOf(parts.weekday!),
  };
}

/** True when `time` is in [start, end); the window may cross midnight. */
function inWindow(time: string, start: string, end: string): boolean {
  return start <= end ? time >= start && time < end : time >= start || time < end;
}

/** Only the nightly window: used for notifications to parents, who are not at school. */
export function isNightlyQuietTime(time: string, settings: ReminderSettings): boolean {
  return inWindow(time, settings.quietStart, settings.quietEnd);
}

export function isQuietTime(
  at: Pick<LocalClock, 'time' | 'weekday'>,
  settings: ReminderSettings,
): boolean {
  if (inWindow(at.time, settings.quietStart, settings.quietEnd)) return true;
  const weekday = at.weekday >= 1 && at.weekday <= 5;
  return weekday && inWindow(at.time, settings.weekdayQuietStart, settings.weekdayQuietEnd);
}

/**
 * True when none of the later checks falls on the same local day outside quiet hours, so this
 * check is the last chance to send anything still to come today.
 */
function isLastCheckToday(local: LocalClock, laterChecks: Date[], settings: ReminderSettings) {
  return !laterChecks.some((t) => {
    const next = localClock(t, settings.timeZone);
    return next.date === local.date && !isQuietTime(next, settings);
  });
}

/**
 * The reminders to send now. A reminder is due from its set time. Checks only run at fixed
 * times (crons.ts), so when `laterChecks` (the check times after now) shows that this is the
 * last check of the day before quiet hours, a reminder set for later today is sent now rather
 * than lost. Without `laterChecks`, only reminders whose time has passed are sent.
 */
export function dueReminders(
  now: Date,
  settings: ReminderSettings,
  state: ReminderState,
  laterChecks?: Date[],
): DueReminder[] {
  if (!settings.enabled || state.practisedToday) return [];
  const local = localClock(now, settings.timeZone);
  if (isQuietTime(local, settings)) return [];
  const lastChance = laterChecks !== undefined && isLastCheckToday(local, laterChecks, settings);
  const reached = (time: string) => lastChance || local.time >= time;

  const due: DueReminder[] = [];
  const sent = new Set(state.sentToday);
  if (
    settings.sessionReminders &&
    !sent.has('session') &&
    state.plannedSessionsToday > 0 &&
    reached(settings.sessionReminderTime)
  ) {
    due.push({
      kind: 'session',
      localDate: local.date,
      message: 'You have a revision session planned for today. Ready when you are!',
    });
  }
  if (
    settings.streakReminders &&
    !sent.has('streak') &&
    state.currentStreak > 0 &&
    reached(settings.streakReminderTime)
  ) {
    due.push({
      kind: 'streak',
      localDate: local.date,
      message: `Keep your ${state.currentStreak}-day streak going: a few questions will do it.`,
    });
  }
  const remaining = Math.max(0, MAX_REMINDERS_PER_DAY - state.sentToday.length);
  return due.slice(0, remaining);
}
