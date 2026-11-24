import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(join(__dirname, '..', '..', '..', 'public', 'sw.js'), 'utf8');

type Listener = (event: Record<string, unknown>) => void;

function loadWorker(
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>,
  apiBase?: string,
) {
  const listeners: Record<string, Listener> = {};
  const config = new Map<string, Response>(
    apiBase ? [['/reminder-api', new Response(apiBase)]] : [],
  );
  const caches = {
    open: async () => ({
      match: async (key: string) => config.get(key)?.clone(),
      addAll: async () => undefined,
      put: async () => undefined,
    }),
    keys: async () => [],
    delete: async () => true,
    match: async () => undefined,
  };
  const showNotification = vi.fn(async () => undefined);
  const openWindow = vi.fn(async () => undefined);
  const self = {
    location: { origin: 'https://app.test' },
    addEventListener: (type: string, fn: Listener) => (listeners[type] = fn),
    skipWaiting: async () => {},
    clients: { claim: async () => {}, openWindow },
    registration: { showNotification },
  };
  new Function('self', 'caches', 'fetch', source)(self, caches, fetchImpl);

  async function dispatch(type: string, extra: Record<string, unknown> = {}) {
    let waited: Promise<unknown> = Promise.resolve();
    listeners[type]!({ waitUntil: (p: Promise<unknown>) => (waited = p), ...extra });
    await waited;
  }
  return { dispatch, showNotification, openWindow };
}

describe('service worker reminders', () => {
  it('shows the latest reminder text fetched from the API', async () => {
    const fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: 'Keep your 3-day streak going.' })),
    );
    const sw = loadWorker(fetch, 'https://api.example.com/');
    await sw.dispatch('push');
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/v1/student/reminders/latest', {
      credentials: 'include',
    });
    expect(sw.showNotification).toHaveBeenCalledWith(
      'RevisionDen',
      expect.objectContaining({ body: 'Keep your 3-day streak going.', tag: 'reminder' }),
    );
  });

  it('falls back to a friendly generic reminder when the device is locked or offline', async () => {
    const sw = loadWorker(async () => new Response('{}', { status: 401 }));
    await sw.dispatch('push');
    expect(sw.showNotification).toHaveBeenCalledWith(
      'RevisionDen',
      expect.objectContaining({ body: expect.stringMatching(/revision/i) }),
    );
    const offline = loadWorker(async () => {
      throw new TypeError('offline');
    });
    await offline.dispatch('push');
    expect(offline.showNotification).toHaveBeenCalledOnce();
  });

  it('opens the learning path when the reminder is tapped', async () => {
    const sw = loadWorker(async () => new Response('{}'));
    const close = vi.fn();
    await sw.dispatch('notificationclick', { notification: { close } });
    expect(close).toHaveBeenCalled();
    expect(sw.openWindow).toHaveBeenCalledWith('/learn');
  });
});
