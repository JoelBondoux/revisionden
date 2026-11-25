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
  applyReadingSettings,
  DEFAULT_READING_SETTINGS,
  loadReadingSettings,
  saveReadingSettings,
  type ReadingSettings,
  type SettingsStorage,
} from './settings';

export interface ReadingApi {
  settings: ReadingSettings;
  /** Changes, applies and saves this device's reading settings. */
  update(change: Partial<ReadingSettings>): void;
}

const ReadingContext = createContext<ReadingApi>({
  settings: DEFAULT_READING_SETTINGS,
  update: () => undefined,
});

export function useReading(): ReadingApi {
  return useContext(ReadingContext);
}

function browserStorage(): SettingsStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

interface ReadingProviderProps {
  children: ReactNode;
  storage?: SettingsStorage | null;
  /** The element the settings apply to; the page's <html> by default. */
  root?: HTMLElement;
}

/** Applies this device's reading comfort settings across the whole app. */
export function ReadingProvider({ children, storage, root }: ReadingProviderProps) {
  const store = storage === undefined ? browserStorage() : storage;
  const [settings, setSettings] = useState(() => loadReadingSettings(store));

  useEffect(() => {
    applyReadingSettings(root ?? document.documentElement, settings);
  }, [root, settings]);

  const update = useCallback(
    (change: Partial<ReadingSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...change };
        saveReadingSettings(store, next);
        return next;
      });
    },
    [store],
  );

  const api = useMemo(() => ({ settings, update }), [settings, update]);
  return <ReadingContext.Provider value={api}>{children}</ReadingContext.Provider>;
}
