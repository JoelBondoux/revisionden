import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyAppearance,
  DEFAULT_APPEARANCE,
  loadAppearance,
  saveAppearance,
  type AppearanceSettings,
  type SettingsStorage,
} from './settings';

export interface AppearanceApi {
  settings: AppearanceSettings;
  /** Changes, applies and saves this device's appearance settings. */
  update(change: Partial<AppearanceSettings>): void;
}

const AppearanceContext = createContext<AppearanceApi>({
  settings: DEFAULT_APPEARANCE,
  update: () => undefined,
});

export function useAppearance(): AppearanceApi {
  return useContext(AppearanceContext);
}

interface MediaQueryLike {
  matches: boolean;
  addEventListener?(type: 'change', listener: () => void): void;
  removeEventListener?(type: 'change', listener: () => void): void;
}

type MatchMedia = (query: string) => MediaQueryLike;

const DARK_QUERY = '(prefers-color-scheme: dark)';

function browserStorage(): SettingsStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function browserMatchMedia(): MatchMedia | null {
  return typeof window.matchMedia === 'function' ? (q) => window.matchMedia(q) : null;
}

interface AppearanceProviderProps {
  children: ReactNode;
  storage?: SettingsStorage | null;
  /** The element the settings apply to; the page's <html> by default. */
  root?: HTMLElement;
  matchMedia?: MatchMedia | null;
}

/**
 * Applies this device's theme, colours and background pattern across the app, following the
 * device's dark mode while the theme is System. public/appearance-boot.js has already applied the
 * saved choice before the first paint; this keeps it in step after that.
 */
export function AppearanceProvider({
  children,
  storage,
  root,
  matchMedia,
}: AppearanceProviderProps) {
  const store = storage === undefined ? browserStorage() : storage;
  const media = matchMedia === undefined ? browserMatchMedia() : matchMedia;
  const [settings, setSettings] = useState(() => loadAppearance(store));
  const [deviceDark, setDeviceDark] = useState(() => media?.(DARK_QUERY).matches ?? false);

  useEffect(() => {
    const query = media?.(DARK_QUERY);
    if (!query) return undefined;
    const onChange = () => setDeviceDark(query.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, [media]);

  useEffect(() => {
    applyAppearance(root ?? document.documentElement, settings, deviceDark);
  }, [root, settings, deviceDark]);

  const update = useCallback(
    (change: Partial<AppearanceSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...change };
        saveAppearance(store, next);
        return next;
      });
    },
    [store],
  );

  const api = useMemo(() => ({ settings, update }), [settings, update]);
  return <AppearanceContext.Provider value={api}>{children}</AppearanceContext.Provider>;
}
