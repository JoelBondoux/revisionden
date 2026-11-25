import { describe, expect, it } from 'vitest';
import {
  createNotificationsApi,
  createParentPushApi,
  NotificationsApiError,
} from './notificationsApi';

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  };
  return { calls, fetch: fetch as typeof globalThis.fetch };
}

const settings = {
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
  maxPerDay: 2,
};

describe('notifications API client', () => {
  it('reads the VAPID key', async () => {
    const { calls, fetch } = fakeFetch(200, { publicKey: 'BPUB' });
    const api = createNotificationsApi({ baseUrl: 'https://api.example.com', fetch });
    expect(await api.getVapidKey()).toBe('BPUB');
    expect(calls[0]!.url).toBe('https://api.example.com/v1/notifications/vapid-key');
    expect(calls[0]!.init.credentials).toBe('include');
  });

  it('saves and deletes subscriptions', async () => {
    const { calls, fetch } = fakeFetch(201, { subscribed: true });
    const api = createNotificationsApi({ baseUrl: 'https://api.example.com/', fetch });
    const sub = { endpoint: 'https://push.example.com/1', keys: { p256dh: 'p', auth: 'a' } };
    await api.saveSubscription(sub);
    await api.deleteSubscription(sub.endpoint);
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ['POST', 'https://api.example.com/v1/student/push-subscriptions'],
      ['DELETE', 'https://api.example.com/v1/student/push-subscriptions'],
    ]);
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ endpoint: sub.endpoint });
  });

  it('loads and saves reminder settings for a student', async () => {
    const { calls, fetch } = fakeFetch(200, settings);
    const api = createNotificationsApi({ baseUrl: 'https://api.example.com/', fetch });
    expect(await api.getReminderSettings('s 1')).toEqual(settings);
    expect(await api.saveReminderSettings('s 1', { quietStart: '20:00' })).toEqual(settings);
    expect(calls[1]!.url).toBe('https://api.example.com/v1/students/s%201/reminder-settings');
    expect(calls[1]!.init.method).toBe('PUT');
  });

  it('throws on an error status', async () => {
    const { fetch } = fakeFetch(503, { error: { code: 'push_unavailable' } });
    const api = createNotificationsApi({ baseUrl: 'https://api.example.com/', fetch });
    await expect(api.getVapidKey()).rejects.toBeInstanceOf(NotificationsApiError);
  });
});

describe('parent push API client', () => {
  it("saves and deletes the parent device's subscription on the parent routes", async () => {
    const { calls, fetch } = fakeFetch(201, { subscribed: true });
    const api = createParentPushApi({ baseUrl: 'https://api.example.com/', fetch });
    const sub = { endpoint: 'https://push.example.com/x', keys: { p256dh: 'p', auth: 'a' } };
    await api.saveSubscription(sub);
    await api.deleteSubscription(sub.endpoint);
    expect(calls.map((c) => [c.init.method, c.url])).toEqual([
      ['POST', 'https://api.example.com/v1/parent/push-subscriptions'],
      ['DELETE', 'https://api.example.com/v1/parent/push-subscriptions'],
    ]);
    expect(calls[0]!.init.credentials).toBe('include');
  });

  it('reads the same public VAPID key', async () => {
    const { calls, fetch } = fakeFetch(200, { publicKey: 'BPUB' });
    const api = createParentPushApi({ baseUrl: 'https://api.example.com', fetch });
    expect(await api.getVapidKey()).toBe('BPUB');
    expect(calls[0]!.url).toBe('https://api.example.com/v1/notifications/vapid-key');
  });
});
