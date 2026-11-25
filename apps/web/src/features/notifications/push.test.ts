import { describe, expect, it, vi } from 'vitest';
import {
  disableReminders,
  enableReminders,
  pushSupport,
  urlBase64ToUint8Array,
  type PushEnvironment,
} from './push';
import type { NotificationsApi } from './notificationsApi';

function fakeSubscription(endpoint = 'https://push.example.com/abc') {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'BKey', auth: 'auth' } }),
    unsubscribe: vi.fn(async () => true),
  };
}

function fakeEnv(overrides: Partial<PushEnvironment> = {}) {
  let current: ReturnType<typeof fakeSubscription> | null = null;
  const subscribe = vi.fn(async () => (current = fakeSubscription()));
  const env: PushEnvironment = {
    supported: true,
    standalone: true,
    permission: () => 'default',
    requestPermission: vi.fn(async () => 'granted' as NotificationPermission),
    pushManager: async () => ({ subscribe, getSubscription: async () => current }),
    rememberApiBase: vi.fn(async () => undefined),
    ...overrides,
  };
  return { env, subscribe, current: () => current };
}

function fakeApi(): NotificationsApi & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    baseUrl: 'https://api.example.com/',
    getVapidKey: async () => (calls.push('key'), 'BPUBLIC-KEY_base64url00'),
    saveSubscription: async (s) => void calls.push(`save ${s.endpoint}`),
    deleteSubscription: async (e) => void calls.push(`delete ${e}`),
    getReminderSettings: async () => {
      throw new Error('unused');
    },
    saveReminderSettings: async () => {
      throw new Error('unused');
    },
  };
}

describe('urlBase64ToUint8Array', () => {
  it('decodes a base64url VAPID key', () => {
    expect([...urlBase64ToUint8Array('-_8A')]).toEqual([251, 255, 0]);
  });
});

describe('pushSupport', () => {
  it('reports unsupported browsers, and iPhones that need the app on the Home Screen first', () => {
    expect(pushSupport({ ...fakeEnv().env, supported: false })).toBe('unsupported');
    expect(pushSupport({ ...fakeEnv().env, supported: false, standalone: false, ios: true })).toBe(
      'needs-install',
    );
    expect(pushSupport(fakeEnv().env)).toBe('ok');
  });
});

describe('enableReminders', () => {
  it('asks permission only when called, subscribes with the VAPID key and saves the subscription', async () => {
    const { env, subscribe } = fakeEnv();
    const api = fakeApi();
    expect(await enableReminders(env, api)).toBe('on');
    expect(env.requestPermission).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array('BPUBLIC-KEY_base64url00'),
    });
    expect(api.calls).toEqual(['key', 'save https://push.example.com/abc']);
    expect(env.rememberApiBase).toHaveBeenCalledWith('https://api.example.com/');
  });

  it('stops when permission is refused', async () => {
    const { env, subscribe } = fakeEnv({ requestPermission: async () => 'denied' });
    expect(await enableReminders(env, fakeApi())).toBe('blocked');
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('does not ask again when the browser already blocks notifications', async () => {
    const { env } = fakeEnv({ permission: () => 'denied' });
    expect(await enableReminders(env, fakeApi())).toBe('blocked');
    expect(env.requestPermission).not.toHaveBeenCalled();
  });
});

describe('enableReminders for a parent device', () => {
  it("remembers that this device's notifications are for the parent", async () => {
    const rememberAudience = vi.fn(async () => undefined);
    const { env } = fakeEnv({ rememberAudience });
    expect(await enableReminders(env, fakeApi(), 'parent')).toBe('on');
    expect(rememberAudience).toHaveBeenCalledWith('parent');
  });

  it('marks a student device as a student device', async () => {
    const rememberAudience = vi.fn(async () => undefined);
    await enableReminders(fakeEnv({ rememberAudience }).env, fakeApi());
    expect(rememberAudience).toHaveBeenCalledWith('student');
  });
});

describe('disableReminders', () => {
  it('removes the subscription from the server and the browser', async () => {
    const { env, current } = fakeEnv();
    const api = fakeApi();
    await enableReminders(env, api);
    expect(await disableReminders(env, api)).toBe('off');
    expect(api.calls).toContain('delete https://push.example.com/abc');
    expect(current()!.unsubscribe).toHaveBeenCalledOnce();
  });

  it('is fine when there was no subscription', async () => {
    const { env } = fakeEnv();
    expect(await disableReminders(env, fakeApi())).toBe('off');
  });
});
