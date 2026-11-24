import { and, between, eq, gte, inArray } from 'drizzle-orm';
import {
  attempts,
  plans,
  pushSubscriptions,
  reminderLog,
  reminderSettings,
  streaks,
  type Database,
} from '@revisionden/db';
import {
  DEFAULT_REMINDER_SETTINGS,
  dueReminders,
  localClock,
  type ReminderKind,
  type ReminderSettings,
} from './schedule';
import type { PushSender } from './web-push';

export interface ReminderRunSummary {
  /** Students with at least one push subscription. */
  students: number;
  reminders: number;
  pushes: number;
  removed: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function shiftDate(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Settings saved by the parent, or the defaults. */
export async function loadReminderSettings(
  db: Database,
  studentId: string,
): Promise<ReminderSettings> {
  const [row] = await db
    .select()
    .from(reminderSettings)
    .where(eq(reminderSettings.studentId, studentId));
  if (!row) return DEFAULT_REMINDER_SETTINGS;
  const { studentId: _id, updatedAt: _u, ...settings } = row;
  return settings;
}

/** Runs from the Worker's cron trigger: sends each student the reminders due now. */
export async function runReminders(deps: {
  db: Database;
  now: Date;
  sender: PushSender;
}): Promise<ReminderRunSummary> {
  const { db, now, sender } = deps;
  const subs = await db.select().from(pushSubscriptions);
  const byStudent = new Map<string, typeof subs>();
  for (const sub of subs)
    byStudent.set(sub.studentId, [...(byStudent.get(sub.studentId) ?? []), sub]);
  const summary: ReminderRunSummary = {
    students: byStudent.size,
    reminders: 0,
    pushes: 0,
    removed: 0,
  };

  for (const [studentId, targets] of byStudent) {
    const settings = await loadReminderSettings(db, studentId);
    if (!settings.enabled) continue;
    const today = localClock(now, settings.timeZone).date;

    const sent = await db
      .select({ kind: reminderLog.kind })
      .from(reminderLog)
      .where(and(eq(reminderLog.studentId, studentId), eq(reminderLog.localDate, today)));
    const recent = await db
      .select({ createdAt: attempts.createdAt })
      .from(attempts)
      .where(
        and(
          eq(attempts.studentId, studentId),
          gte(attempts.createdAt, new Date(now.getTime() - 2 * DAY_MS)),
        ),
      );
    const [streak] = await db
      .select({ current: streaks.current })
      .from(streaks)
      .where(eq(streaks.studentId, studentId));
    const weekPlans = await db
      .select({ sessions: plans.sessions })
      .from(plans)
      .where(
        and(eq(plans.studentId, studentId), between(plans.weekStart, shiftDate(today, -6), today)),
      );
    const plannedSessionsToday = weekPlans
      .flatMap((p) => (Array.isArray(p.sessions) ? (p.sessions as { date?: unknown }[]) : []))
      .filter((s) => s.date === today).length;

    const due = dueReminders(now, settings, {
      sentToday: sent.map((s) => s.kind as ReminderKind),
      practisedToday: recent.some((a) => localClock(a.createdAt, settings.timeZone).date === today),
      currentStreak: streak?.current ?? 0,
      plannedSessionsToday,
    });

    for (const reminder of due) {
      // The unique (student, kind, day) key stops a second, overlapping run sending it again.
      const logged = await db
        .insert(reminderLog)
        .values({ studentId, ...reminder })
        .onConflictDoNothing()
        .returning({ id: reminderLog.id });
      if (logged.length === 0) continue;
      summary.reminders += 1;

      const gone: string[] = [];
      for (const target of targets) {
        const result = await sender.send(target);
        if (result === 'sent') summary.pushes += 1;
        if (result === 'gone') gone.push(target.id);
      }
      if (gone.length > 0) {
        await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
        summary.removed += gone.length;
        const goneSet = new Set(gone);
        targets.splice(0, targets.length, ...targets.filter((t) => !goneSet.has(t.id)));
      }
    }
  }
  return summary;
}
