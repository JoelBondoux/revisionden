import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';

/** Fired when an API reply suggests this copy of the app is older than the API (see client.ts). */
export const STALE_BUILD_EVENT = 'revisionden:possibly-stale';

/** The build this copy of the app came from (version and commit; vite.config.ts). */
export const CURRENT_BUILD = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

const CHECK_EVERY_MS = 15 * 60 * 1000;
const RELOADED_KEY = 'revisionden.autoReloadedFor';

/** Tells the update banner to check for a newer build now. */
export function reportPossiblyStale(): void {
  window.dispatchEvent(new Event(STALE_BUILD_EVENT));
}

/**
 * The deployed build (`/version.json`, written by the build) when it differs from `current`;
 * null when it is the same or cannot be read. Never answered from a cache.
 */
export async function checkForNewBuild(
  current: string,
  fetchFn: (url: string, init: RequestInit) => Promise<Response> = (...args) =>
    globalThis.fetch(...args),
): Promise<string | null> {
  try {
    const res = await fetchFn('/version.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { build?: unknown };
    return typeof body.build === 'string' && body.build !== current ? body.build : null;
  } catch {
    return null;
  }
}

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function sessionStore(): KeyValueStorage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

interface UpdateBannerProps {
  check?: () => Promise<string | null>;
  reload?: () => void;
  storage?: KeyValueStorage;
}

/**
 * Keeps people on the newest build. Checks on start, when the app comes back to the foreground
 * and every 15 minutes, and offers "Refresh" when a new version is deployed. When an API reply
 * looks like this build is out of date, it reloads by itself, once per new build (no loops).
 */
export function UpdateBanner({
  check = () => checkForNewBuild(CURRENT_BUILD),
  reload = () => window.location.reload(),
  storage = sessionStore(),
}: UpdateBannerProps) {
  const [ready, setReady] = useState(false);
  const busy = useRef(false);

  const run = useCallback(
    async (fromApi: boolean) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const newer = await check();
        if (!newer) return;
        setReady(true);
        let reloadedFor: string | null = null;
        try {
          reloadedFor = storage?.getItem(RELOADED_KEY) ?? null;
        } catch {
          // Storage blocked: only the banner, never an automatic reload.
          return;
        }
        if (fromApi && storage && reloadedFor !== newer) {
          storage.setItem(RELOADED_KEY, newer);
          reload();
        }
      } finally {
        busy.current = false;
      }
    },
    [check, reload, storage],
  );

  useEffect(() => {
    void run(false);
    const onVisible = () => document.visibilityState !== 'hidden' && void run(false);
    const onStale = () => void run(true);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(STALE_BUILD_EVENT, onStale);
    const timer = setInterval(() => void run(false), CHECK_EVERY_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(STALE_BUILD_EVENT, onStale);
      clearInterval(timer);
    };
  }, [run]);

  if (!ready) return null;
  return (
    <div role="status" className="update-banner">
      <span>A new version of RevisionDen is ready.</span>
      <Button onClick={reload}>Refresh</Button>
    </div>
  );
}
