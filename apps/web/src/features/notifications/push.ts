import type { NotificationsApi, SubscriptionJson } from './notificationsApi';

/** The calls push needs; the parent client has these too. */
export type PushApi = Pick<
  NotificationsApi,
  'baseUrl' | 'getVapidKey' | 'saveSubscription' | 'deleteSubscription'
>;

/** Who this device's pushes are for: the service worker fetches different text for each. */
export type PushAudience = 'student' | 'parent';

interface MinimalSubscription {
  endpoint: string;
  toJSON(): unknown;
  unsubscribe(): Promise<boolean>;
}

interface MinimalPushManager {
  subscribe(options: {
    userVisibleOnly: boolean;
    applicationServerKey: Uint8Array;
  }): Promise<MinimalSubscription>;
  getSubscription(): Promise<MinimalSubscription | null>;
}

/** What the browser gives us; injected so tests need no real push service. */
export interface PushEnvironment {
  supported: boolean;
  /** Running as an installed app (needed for push on iPhone and iPad). */
  standalone: boolean;
  ios?: boolean;
  permission(): NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  pushManager(): Promise<MinimalPushManager>;
  /** Tells the service worker where the API is, so it can fetch the reminder text. */
  rememberApiBase(baseUrl: string): Promise<void>;
  /** Tells the service worker whether pushes here are for the student or the parent. */
  rememberAudience?(audience: PushAudience): Promise<void>;
}

export type PushSupport = 'ok' | 'unsupported' | 'needs-install';
export type ReminderState = 'on' | 'off' | 'blocked';

export function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function pushSupport(env: PushEnvironment): PushSupport {
  if (env.supported) return 'ok';
  // iOS and iPadOS only offer web push to apps added to the Home Screen.
  return env.ios && !env.standalone ? 'needs-install' : 'unsupported';
}

/** Asks for permission (only now, after a tap), subscribes and saves the subscription. */
export async function enableReminders(
  env: PushEnvironment,
  api: PushApi,
  audience: PushAudience = 'student',
): Promise<ReminderState> {
  if (env.permission() === 'denied') return 'blocked';
  const permission = env.permission() === 'granted' ? 'granted' : await env.requestPermission();
  if (permission !== 'granted') return 'blocked';
  const key = urlBase64ToUint8Array(await api.getVapidKey());
  const manager = await env.pushManager();
  const subscription = await manager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
  await api.saveSubscription(subscription.toJSON() as SubscriptionJson);
  await env.rememberApiBase(api.baseUrl);
  await env.rememberAudience?.(audience);
  return 'on';
}

export async function disableReminders(env: PushEnvironment, api: PushApi): Promise<ReminderState> {
  const subscription = await (await env.pushManager()).getSubscription();
  if (subscription) {
    await api.deleteSubscription(subscription.endpoint);
    await subscription.unsubscribe();
  }
  return 'off';
}

/** The current state, without asking for anything. */
export async function currentReminderState(env: PushEnvironment): Promise<ReminderState> {
  if (env.permission() === 'denied') return 'blocked';
  if (env.permission() !== 'granted') return 'off';
  return (await (await env.pushManager()).getSubscription()) ? 'on' : 'off';
}

/** The real browser environment. */
export function browserPushEnvironment(
  win: Window & { Notification?: typeof Notification } = window,
): PushEnvironment {
  const nav = win.navigator;
  const supported = 'serviceWorker' in nav && 'PushManager' in win && 'Notification' in win;
  return {
    supported,
    standalone: win.matchMedia?.('(display-mode: standalone)').matches ?? false,
    ios:
      /iPad|iPhone|iPod/.test(nav.userAgent) ||
      (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1),
    permission: () => win.Notification?.permission ?? 'denied',
    requestPermission: async () => (await win.Notification?.requestPermission()) ?? 'denied',
    pushManager: async () =>
      (await nav.serviceWorker.ready).pushManager as unknown as MinimalPushManager,
    rememberApiBase: async (baseUrl) => {
      const cache = await win.caches.open('rd-config');
      await cache.put('/reminder-api', new Response(baseUrl));
    },
    rememberAudience: async (audience) => {
      const cache = await win.caches.open('rd-config');
      await cache.put('/push-audience', new Response(audience));
    },
  };
}
