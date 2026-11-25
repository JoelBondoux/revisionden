import {
  INSTALL_DISMISS_DAYS,
  createInstallStore,
  dismissInstall,
  installDismissed,
  installState,
  iosDevice,
  type InstallPromptEvent,
} from './install';

const DAY = 24 * 60 * 60 * 1000;

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

function fakePromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt') as InstallPromptEvent;
  Object.assign(event, {
    prompt: vi.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  });
  return event;
}

describe('which install option this device gets', () => {
  it('uses the browser’s own install prompt when there is one (Chrome, Edge, Android)', () => {
    expect(installState({ standalone: false, hasPrompt: true, ios: null })).toBe('prompt');
  });

  it('shows the Share → Add to Home Screen steps on an iPhone or iPad', () => {
    expect(installState({ standalone: false, hasPrompt: false, ios: 'iphone' })).toBe('ios');
    expect(installState({ standalone: false, hasPrompt: false, ios: 'ipad' })).toBe('ios');
  });

  it('offers nothing where the browser cannot install apps (Firefox on a computer)', () => {
    expect(installState({ standalone: false, hasPrompt: false, ios: null })).toBe('unsupported');
  });

  it('knows when RevisionDen is already installed', () => {
    expect(installState({ standalone: true, hasPrompt: true, ios: null })).toBe('installed');
    expect(installState({ standalone: false, hasPrompt: true, ios: null, installed: true })).toBe(
      'installed',
    );
  });
});

describe('telling an iPhone from an iPad', () => {
  it('reads the browser’s description of the device', () => {
    expect(
      iosDevice({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 5,
      }),
    ).toBe('iphone');
    expect(
      iosDevice({
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
        platform: 'iPad',
        maxTouchPoints: 5,
      }),
    ).toBe('ipad');
    // iPadOS Safari says it is a Mac, but a Mac has no touch screen.
    expect(
      iosDevice({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ).toBe('ipad');
    expect(
      iosDevice({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      }),
    ).toBeNull();
    expect(
      iosDevice({
        userAgent: 'Mozilla/5.0 (Linux; Android 15)',
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
      }),
    ).toBeNull();
  });
});

describe('"Not now"', () => {
  it(`hides the card on this device for ${INSTALL_DISMISS_DAYS} days`, () => {
    const storage = memoryStorage();
    const now = new Date('2026-11-25T10:00:00Z');
    expect(installDismissed(storage, now)).toBe(false);
    dismissInstall(storage, now);
    expect(storage.map.get('revisionden.installDismissed')).toBe('2026-11-25T10:00:00.000Z');
    expect(installDismissed(storage, new Date(now.getTime() + 29 * DAY))).toBe(true);
    expect(installDismissed(storage, new Date(now.getTime() + 31 * DAY))).toBe(false);
  });

  it('ignores storage that is blocked or holds nonsense', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(installDismissed(blocked, new Date())).toBe(false);
    expect(() => dismissInstall(blocked, new Date())).not.toThrow();
    const odd = memoryStorage();
    odd.setItem('revisionden.installDismissed', 'yesterday');
    expect(installDismissed(odd, new Date())).toBe(false);
  });
});

describe('the install prompt store', () => {
  it('keeps the browser’s install prompt for later and shows it on tap', async () => {
    const target = new EventTarget();
    const store = createInstallStore(target);
    expect(store.get().hasPrompt).toBe(false);
    const event = fakePromptEvent('accepted');
    const preventDefault = vi.spyOn(event, 'preventDefault');
    target.dispatchEvent(event);
    expect(preventDefault).toHaveBeenCalled();
    expect(store.get().hasPrompt).toBe(true);
    expect(await store.install()).toBe('accepted');
    expect(event.prompt).toHaveBeenCalled();
    expect(store.get()).toEqual({ hasPrompt: false, installed: true });
  });

  it('keeps the card when the person cancels the browser prompt, but the prompt is used up', async () => {
    const target = new EventTarget();
    const store = createInstallStore(target);
    target.dispatchEvent(fakePromptEvent('dismissed'));
    expect(await store.install()).toBe('dismissed');
    expect(store.get()).toEqual({ hasPrompt: false, installed: false });
  });

  it('notices when the app is installed some other way (the browser menu)', () => {
    const target = new EventTarget();
    const store = createInstallStore(target);
    const seen = vi.fn();
    store.subscribe(seen);
    target.dispatchEvent(new Event('appinstalled'));
    expect(store.get().installed).toBe(true);
    expect(seen).toHaveBeenCalled();
  });

  it('says there is nothing to install with when no prompt arrived', async () => {
    const store = createInstallStore(new EventTarget());
    expect(await store.install()).toBe('unavailable');
  });
});
