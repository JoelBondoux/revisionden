/**
 * "Add RevisionDen to this device" (workstream I6). Chrome, Edge and Android fire
 * `beforeinstallprompt`, which we keep and show on tap. iPhone and iPad Safari have no prompt, so
 * they get Share → Add to Home Screen steps. Browsers that cannot install (Firefox on a computer)
 * get nothing. Hidden once installed, or for 30 days after "Not now" on this device.
 */

/** The browser's install prompt event (not in TypeScript's DOM types yet). */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type IosDevice = 'iphone' | 'ipad';
export type InstallState = 'prompt' | 'ios' | 'unsupported' | 'installed';

export function installState(env: {
  standalone: boolean;
  hasPrompt: boolean;
  ios: IosDevice | null;
  installed?: boolean;
}): InstallState {
  if (env.standalone || env.installed) return 'installed';
  if (env.hasPrompt) return 'prompt';
  return env.ios ? 'ios' : 'unsupported';
}

/** iPhone or iPad (iPadOS Safari calls itself a Mac, but a Mac has no touch screen). */
export function iosDevice(nav: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}): IosDevice | null {
  if (/iPhone|iPod/.test(nav.userAgent)) return 'iphone';
  if (/iPad/.test(nav.userAgent)) return 'ipad';
  if (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1) return 'ipad';
  return null;
}

/** True when the app runs from the Home Screen or as an installed app. */
export function isStandalone(win: Window = window): boolean {
  const iosStandalone = (win.navigator as Navigator & { standalone?: boolean }).standalone;
  return (
    iosStandalone === true || (win.matchMedia?.('(display-mode: standalone)').matches ?? false)
  );
}

export const INSTALL_DISMISS_DAYS = 30;
const DISMISS_KEY = 'revisionden.installDismissed';
const DAY_MS = 24 * 60 * 60 * 1000;

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** True within 30 days of "Not now" on this device (local storage; see cookies-and-storage.md). */
export function installDismissed(storage: KeyValueStorage | undefined, now: Date): boolean {
  try {
    const at = Date.parse(storage?.getItem(DISMISS_KEY) ?? '');
    return Number.isFinite(at) && now.getTime() - at < INSTALL_DISMISS_DAYS * DAY_MS;
  } catch {
    return false;
  }
}

export function dismissInstall(storage: KeyValueStorage | undefined, now: Date): void {
  try {
    storage?.setItem(DISMISS_KEY, now.toISOString());
  } catch {
    // Storage blocked (private mode): hidden for this visit only.
  }
}

export interface InstallSnapshot {
  hasPrompt: boolean;
  installed: boolean;
}

/**
 * Keeps the browser's install prompt (it fires once, early) until the person taps the button,
 * and notices `appinstalled`. Shaped for `useSyncExternalStore`.
 */
export function createInstallStore(target: EventTarget) {
  let event: InstallPromptEvent | null = null;
  let snapshot: InstallSnapshot = { hasPrompt: false, installed: false };
  const listeners = new Set<() => void>();
  const set = (next: InstallSnapshot) => {
    snapshot = next;
    listeners.forEach((l) => l());
  };
  target.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Show it on our button, not as the browser's own mini bar.
    event = e as InstallPromptEvent;
    set({ ...snapshot, hasPrompt: true });
  });
  target.addEventListener('appinstalled', () => {
    event = null;
    set({ hasPrompt: false, installed: true });
  });
  return {
    get: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    /** Shows the browser's install prompt; a prompt can be used once. */
    async install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
      const prompt = event;
      if (!prompt) return 'unavailable';
      event = null;
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      set({ hasPrompt: false, installed: outcome === 'accepted' || snapshot.installed });
      return outcome;
    },
  };
}

export type InstallStore = ReturnType<typeof createInstallStore>;
