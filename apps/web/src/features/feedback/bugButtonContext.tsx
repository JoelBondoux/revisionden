import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** Per-device choice to show the bug button: "off" hides it; anything else (or nothing) shows it. */
export const BUG_BUTTON_KEY = 'revisionden.bugButton';

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface BugButtonValue {
  /** The device setting (Settings, "Show the bug button"). */
  shown: boolean;
  setShown: (shown: boolean) => void;
  /** True while any screen (timed paper, Test mode question) asks for the button to go away. */
  hiddenByScreen: boolean;
  hide: () => () => void;
}

const BugButtonContext = createContext<BugButtonValue>({
  shown: true,
  setShown: () => {},
  hiddenByScreen: false,
  hide: () => () => {},
});

function browserStorage(): KeyValueStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function readShown(storage: KeyValueStorage | undefined): boolean {
  try {
    return storage?.getItem(BUG_BUTTON_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Holds the bug button's device setting and which screens want it hidden. */
export function BugButtonProvider({
  storage = browserStorage(),
  children,
}: {
  storage?: KeyValueStorage;
  children: ReactNode;
}) {
  const [shown, setShownState] = useState(() => readShown(storage));
  const [hiders, setHiders] = useState(0);

  const setShown = useCallback(
    (next: boolean) => {
      setShownState(next);
      try {
        storage?.setItem(BUG_BUTTON_KEY, next ? 'on' : 'off');
      } catch {
        // Storage blocked (private mode): keep the choice for this visit only.
      }
    },
    [storage],
  );

  // A counter, so the button comes back only when every screen that hid it has let go.
  const hide = useCallback(() => {
    setHiders((n) => n + 1);
    return () => setHiders((n) => n - 1);
  }, []);

  const value = useMemo(
    () => ({ shown, setShown, hiddenByScreen: hiders > 0, hide }),
    [shown, setShown, hiders, hide],
  );
  return <BugButtonContext.Provider value={value}>{children}</BugButtonContext.Provider>;
}

export function useBugButton(): BugButtonValue {
  return useContext(BugButtonContext);
}

/** True when the bug button is on screen (switched on and no screen is hiding it). */
export function useBugButtonVisible(): boolean {
  const { shown, hiddenByScreen } = useBugButton();
  return shown && !hiddenByScreen;
}

/** Hides the bug button while `hidden` is true and the calling screen is showing. */
export function useHideBugButton(hidden: boolean): void {
  const { hide } = useBugButton();
  useEffect(() => (hidden ? hide() : undefined), [hidden, hide]);
}
