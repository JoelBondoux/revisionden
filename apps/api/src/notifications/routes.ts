import { Hono } from 'hono';
import { and, desc, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import {
  parentPushSubscriptions,
  parentRewards,
  pushSubscriptions,
  reminderLog,
  reminderSettings,
  students,
  type Database,
} from '@revisionden/db';
import type { AppEnv } from '../context';
import type { AppConfig } from '../env';
import { ApiError } from '../errors';
import { requireFamilyStudent } from '../families';
import { readJson } from '../http';
import type { Clock } from '../rate-limit';
import { loadReminderSettings } from './runner';
import { parentRewardMessage } from './parent-rewards';
import { MAX_REMINDERS_PER_DAY } from './schedule';

export interface NotificationDeps {
  db: Database;
  config: AppConfig;
  clock: Clock;
}

// TODO(workstream C): move these request schemas into packages/core.
const subscribeSchema = z
  .object({
    endpoint: z
      .string()
      .url()
      .max(1000)
      .refine((u) => u.startsWith('https://'), 'The push endpoint must use https'),
    keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  })
  .passthrough();
const unsubscribeSchema = z.object({ endpoint: z.string().max(1000) }).passthrough();

const time = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Use a 24-hour time like 21:00');
const timeZone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Unknown time zone');
const settingsUpdateSchema = z
  .object({
    enabled: z.boolean(),
    streakReminders: z.boolean(),
    sessionReminders: z.boolean(),
    quietStart: time,
    quietEnd: time,
    weekdayQuietStart: time,
    weekdayQuietEnd: time,
    sessionReminderTime: time,
    streakReminderTime: time,
    timeZone,
  })
  .partial()
  .strict();

const LATEST_REMINDER_MS = 24 * 60 * 60 * 1000;

/** GET /v1/notifications/vapid-key: the public key browsers subscribe with. */
export function pushKeyRoutes({ config }: Pick<NotificationDeps, 'config'>) {
  const app = new Hono<AppEnv>();
  app.get('/vapid-key', (c) => {
    if (!config.push) {
      throw new ApiError(503, 'push_unavailable', 'Reminders are not switched on yet.');
    }
    return c.json({ publicKey: config.push.keys.publicKey });
  });
  return app;
}

/** Student device routes under /v1/student (the student session is checked by the caller). */
export function studentNotificationRoutes({ db, clock }: NotificationDeps) {
  const app = new Hono<AppEnv>();

  app.post('/push-subscriptions', async (c) => {
    const body = await readJson(c, subscribeSchema);
    const { studentId, deviceId } = c.var.student;
    const values = {
      studentId,
      deviceId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    };
    await db
      .insert(pushSubscriptions)
      .values(values)
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
    return c.json({ subscribed: true }, 201);
  });

  app.delete('/push-subscriptions', async (c) => {
    const { endpoint } = await readJson(c, unsubscribeSchema);
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, endpoint),
          eq(pushSubscriptions.studentId, c.var.student.studentId),
        ),
      );
    return c.body(null, 204);
  });

  app.get('/reminders/latest', async (c) => {
    const since = new Date(clock.now().getTime() - LATEST_REMINDER_MS);
    const [row] = await db
      .select({ message: reminderLog.message })
      .from(reminderLog)
      .where(and(eq(reminderLog.studentId, c.var.student.studentId), gt(reminderLog.sentAt, since)))
      .orderBy(desc(reminderLog.sentAt))
      .limit(1);
    return c.json({ message: row?.message ?? null });
  });

  return app;
}

/** Parent routes under /v1/students: reminder settings per student. */
export function parentReminderRoutes({ db }: NotificationDeps) {
  const app = new Hono<AppEnv>();

  async function current(studentId: string) {
    return { ...(await loadReminderSettings(db, studentId)), maxPerDay: MAX_REMINDERS_PER_DAY };
  }

  app.get('/:id/reminder-settings', async (c) => {
    const student = await requireFamilyStudent(db, c.var.parent.familyId, c.req.param('id'));
    return c.json(await current(student.id));
  });

  app.put('/:id/reminder-settings', async (c) => {
    const student = await requireFamilyStudent(db, c.var.parent.familyId, c.req.param('id'));
    const update = await readJson(c, settingsUpdateSchema);
    await db
      .insert(reminderSettings)
      .values({ studentId: student.id, ...update })
      .onConflictDoUpdate({
        target: reminderSettings.studentId,
        set: { ...update, updatedAt: new Date() },
      });
    return c.json(await current(student.id));
  });

  return app;
}

/**
 * Parent device routes under /v1/parent (the parent session is checked by the caller): push on
 * the parent's own devices, used only to say a parent-set reward target was met.
 */
export function parentNotificationRoutes({ db, clock }: NotificationDeps) {
  const app = new Hono<AppEnv>();

  app.post('/push-subscriptions', async (c) => {
    const body = await readJson(c, subscribeSchema);
    const values = {
      parentId: c.var.parent.parentId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    };
    await db
      .insert(parentPushSubscriptions)
      .values(values)
      .onConflictDoUpdate({ target: parentPushSubscriptions.endpoint, set: values });
    return c.json({ subscribed: true }, 201);
  });

  app.delete('/push-subscriptions', async (c) => {
    const { endpoint } = await readJson(c, unsubscribeSchema);
    await db
      .delete(parentPushSubscriptions)
      .where(
        and(
          eq(parentPushSubscriptions.endpoint, endpoint),
          eq(parentPushSubscriptions.parentId, c.var.parent.parentId),
        ),
      );
    return c.body(null, 204);
  });

  app.get('/notifications/latest', async (c) => {
    const since = new Date(clock.now().getTime() - LATEST_REMINDER_MS);
    const [row] = await db
      .select({ nickname: students.nickname, title: parentRewards.title })
      .from(parentRewards)
      .innerJoin(students, eq(students.id, parentRewards.studentId))
      .where(
        and(
          eq(students.familyId, c.var.parent.familyId),
          gt(parentRewards.reachedNotifiedAt, since),
        ),
      )
      .orderBy(desc(parentRewards.reachedNotifiedAt))
      .limit(1);
    return c.json({ message: row ? parentRewardMessage(row.nickname, row.title) : null });
  });

  return app;
}
