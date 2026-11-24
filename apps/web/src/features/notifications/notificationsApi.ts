import { z } from 'zod';

/** Reminder settings a parent can change (times are local "HH:MM"). */
export const reminderSettingsSchema = z.object({
  enabled: z.boolean(),
  streakReminders: z.boolean(),
  sessionReminders: z.boolean(),
  quietStart: z.string(),
  quietEnd: z.string(),
  weekdayQuietStart: z.string(),
  weekdayQuietEnd: z.string(),
  sessionReminderTime: z.string(),
  streakReminderTime: z.string(),
  timeZone: z.string(),
  maxPerDay: z.number().int(),
});
export type ReminderSettings = z.infer<typeof reminderSettingsSchema>;
export type ReminderSettingsUpdate = Partial<Omit<ReminderSettings, 'maxPerDay'>>;

export interface SubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface NotificationsApi {
  baseUrl: string;
  getVapidKey(): Promise<string>;
  saveSubscription(subscription: SubscriptionJson): Promise<void>;
  deleteSubscription(endpoint: string): Promise<void>;
  getReminderSettings(studentId: string): Promise<ReminderSettings>;
  saveReminderSettings(
    studentId: string,
    update: ReminderSettingsUpdate,
  ): Promise<ReminderSettings>;
}

export class NotificationsApiError extends Error {
  constructor(readonly status: number) {
    super(`The server replied with ${status}.`);
    this.name = 'NotificationsApiError';
  }
}

/** Calls the real API routes (apps/api notifications). Sends the session cookies. */
export function createNotificationsApi(options: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}): NotificationsApi {
  const fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
  const root = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;

  async function send(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(new URL(path, root), {
      credentials: 'include',
      ...init,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers },
    });
    if (!res.ok) throw new NotificationsApiError(res.status);
    return res;
  }
  const settingsPath = (id: string) => `v1/students/${encodeURIComponent(id)}/reminder-settings`;

  return {
    baseUrl: root,
    getVapidKey: async () =>
      z
        .object({ publicKey: z.string() })
        .parse(await (await send('v1/notifications/vapid-key')).json()).publicKey,
    saveSubscription: async (subscription) =>
      void (await send('v1/student/push-subscriptions', {
        method: 'POST',
        body: JSON.stringify(subscription),
      })),
    deleteSubscription: async (endpoint) =>
      void (await send('v1/student/push-subscriptions', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint }),
      })),
    getReminderSettings: async (id) =>
      reminderSettingsSchema.parse(await (await send(settingsPath(id))).json()),
    saveReminderSettings: async (id, update) =>
      reminderSettingsSchema.parse(
        await (
          await send(settingsPath(id), { method: 'PUT', body: JSON.stringify(update) })
        ).json(),
      ),
  };
}
