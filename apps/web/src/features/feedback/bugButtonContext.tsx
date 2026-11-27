import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useInRouterContext, useLocation } from 'react-router-dom';
import { useStudent } from '../../session/StudentContext';
import { useFeedbackApi, type BugButtonInfo } from './feedbackApi';

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
  /** L13: on a student's device, whether the server has the button resting or removed. */
  rest: BugButtonInfo;
}

const BugButtonContext = createContext<BugButtonValue>({
  shown: true,
  setShown: () => {},
  hiddenByScreen: false,
  hide: () => () => {},
  rest: { state: 'on' },
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
  const [rest, refresh] = useServerRest();
  const inRouter = useInRouterContext();

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
    () => ({ shown, setShown, hiddenByScreen: hiders > 0, hide, rest }),
    [shown, setShown, hiders, hide, rest],
  );
  return (
    <BugButtonContext.Provider value={value}>
      {inRouter && <RouteRefresh refresh={refresh} />}
      {children}
    </BugButtonContext.Provider>
  );
}

/** The longest a timer can wait (about 24.8 days); a later rest end is checked again then. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * L13: asks the server, on a student's device only, whether the bug button is resting or removed.
 * It asks again when the app comes back into view (a parent may have switched it back on), on
 * every page change (see RouteRefresh) and when a rest ends. If the server can't be reached the
 * button stays: the server still refuses a bug report then.
 */
function useServerRest(): [BugButtonInfo, () => void] {
  const { studentId } = useStudent();
  const api = useFeedbackApi();
  const [rest, setRest] = useState<BugButtonInfo>({ state: 'on' });
  const [asks, setAsks] = useState(0);
  const refresh = useCallback(() => setAsks((n) => n + 1), []);

  useEffect(() => {
    if (!studentId) {
      setRest({ state: 'on' });
      return;
    }
    let live = true;
    api.bugButton().then(
      (next) => live && setRest(next),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [api, studentId, asks]);

  useEffect(() => {
    if (!studentId) return;
    const onVisible = () => {
      if (document.visibilityState !== 'hidden') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [studentId, refresh]);

  const until = rest.state === 'paused' ? rest.until : undefined;
  useEffect(() => {
    if (!until) return;
    const wait = Math.min(Math.max(new Date(until).getTime() - Date.now(), 0), MAX_TIMER_MS);
    const timer = setTimeout(refresh, wait);
    return () => clearTimeout(timer);
  }, [until, refresh]);

  return [rest, refresh];
}

/** Asks for the rest state again on each page change (only inside a router, as in AppLayout). */
function RouteRefresh({ refresh }: { refresh: () => void }) {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    refresh();
  }, [pathname, refresh]);
  return null;
}

export function useBugButton(): BugButtonValue {
  return useContext(BugButtonContext);
}

/** True when the bug button is on screen (switched on, not resting, no screen hiding it). */
export function useBugButtonVisible(): boolean {
  const { shown, hiddenByScreen, rest } = useBugButton();
  return shown && !hiddenByScreen && rest.state === 'on';
}

/** Hides the bug button while `hidden` is true and the calling screen is showing. */
export function useHideBugButton(hidden: boolean): void {
  const { hide } = useBugButton();
  useEffect(() => (hidden ? hide() : undefined), [hidden, hide]);
}
