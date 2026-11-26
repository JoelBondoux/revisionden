import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  DEFAULT_EFFECT_STYLE,
  EFFECT_STYLES,
  applyEffectStyle,
  chooseEffectStyle,
  loadEffectStyle,
  saveEffectStyle,
} from './registry';
import { isEffectStyleId } from './registry';
import type { EffectStyle, EffectStyleId, StyleStorage } from './registry';
import { useStudent } from '../../../session/StudentContext';
import { useFeedbackStyle } from '../../sound/SoundProvider';
import { fetchUnlockedStyles } from './effectStylesApi';
import '@fontsource/patrick-hand/400.css';
import './doodle-diary.css';
import './sticker-book.css';
import './pop-burst.css';
import './starlight.css';
import './garden-grow.css';
import './comic-pop.css';
import './pixel-arcade.css';

export interface EffectStyleApi {
  style: EffectStyle;
  styleId: EffectStyleId;
  /** Styles this child can use (Doodle Diary is always one of them). */
  unlocked: readonly EffectStyleId[];
  choose(id: EffectStyleId): void;
  /** Checks the server again for styles earned since the last check (the picker calls it). */
  refresh(): void;
  /**
   * The dev environment's style tester (J12c), or null anywhere else. Only the API turns it on
   * (it sends `testerStyles` in development only), so a stray build cannot show it. Trying a style
   * unlocks nothing; it is remembered apart from the real choice until reset.
   */
  tester: StyleTester | null;
}

export interface StyleTester {
  /** Every style, Doodle Diary first. */
  styles: readonly EffectStyleId[];
  /** The style being tried, or null for the real choice. */
  trying: EffectStyleId | null;
  tryStyle(id: EffectStyleId): void;
  reset(): void;
}

const fallback: EffectStyleApi = {
  style: EFFECT_STYLES[DEFAULT_EFFECT_STYLE],
  styleId: DEFAULT_EFFECT_STYLE,
  unlocked: [DEFAULT_EFFECT_STYLE],
  choose: () => undefined,
  refresh: () => undefined,
  tester: null,
};

/** Where this device remembers the style a tester is trying (J12c), apart from the real choice. */
export const STYLE_TESTER_KEY = 'revisionden.effectStyleTester';

/** What the server says about effect styles; tests may pass just the unlocked list. */
export type EffectStyleAccess = { unlocked: readonly string[]; testerStyles?: readonly string[] };

const isStyleList = (value: readonly string[] | EffectStyleAccess): value is readonly string[] =>
  Array.isArray(value);

function loadTrying(storage: StyleStorage | null): EffectStyleId | null {
  try {
    const saved = storage?.getItem(STYLE_TESTER_KEY);
    return isEffectStyleId(saved) ? saved : null;
  } catch {
    return null;
  }
}

function saveTrying(
  storage: (StyleStorage & { removeItem?(key: string): void }) | null,
  id: EffectStyleId | null,
) {
  try {
    if (id) storage?.setItem(STYLE_TESTER_KEY, id);
    else storage?.removeItem?.(STYLE_TESTER_KEY);
  } catch {
    // Private browsing or blocked site data: keep going without saving.
  }
}

const EffectStyleContext = createContext<EffectStyleApi>(fallback);

function deviceStorage(): (StyleStorage & { removeItem?(key: string): void }) | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Applies the active effect style to the page and lets screens read or change it. */
export function EffectStyleProvider({
  children,
  loadUnlocked = fetchUnlockedStyles,
  quiet = false,
  revalidateKey,
}: {
  children: ReactNode;
  /** Loads the signed-in student's unlocked styles (tests pass their own). */
  loadUnlocked?: () => Promise<readonly string[] | EffectStyleAccess>;
  /** True on screens that must make no API calls (Get help): nothing is loaded while quiet. */
  quiet?: boolean;
  /** Changes with each screen; a load that failed (say, before unlocking) is tried again. */
  revalidateKey?: string;
}) {
  const { studentId } = useStudent();
  const [saved, setSaved] = useState<EffectStyleId>(() => loadEffectStyle(deviceStorage()));
  const [earned, setEarned] = useState<readonly EffectStyleId[]>([]);
  const [testerStyles, setTesterStyles] = useState<readonly EffectStyleId[] | null>(null);
  const [trying, setTrying] = useState<EffectStyleId | null>(() => loadTrying(deviceStorage()));
  // Which student the last load was for, whether it worked, and whether one is in flight.
  const status = useRef<{ for: string | null; ok: boolean; busy: boolean }>({
    for: null,
    ok: false,
    busy: false,
  });

  const load = useCallback(() => {
    if (!studentId || quiet || status.current.busy) return;
    const forStudent = studentId;
    status.current = { for: forStudent, ok: false, busy: true };
    loadUnlocked()
      .then((result) => {
        if (status.current.for !== forStudent) return;
        status.current = { for: forStudent, ok: true, busy: false };
        const access: EffectStyleAccess = isStyleList(result) ? { unlocked: result } : result;
        setEarned(access.unlocked.filter(isEffectStyleId));
        setTesterStyles(access.testerStyles ? access.testerStyles.filter(isEffectStyleId) : null);
      })
      .catch(() => {
        if (status.current.for === forStudent) status.current.busy = false;
      });
  }, [studentId, quiet, loadUnlocked]);

  // A new student starts from nothing; load for them as soon as the screen allows.
  useEffect(() => {
    if (status.current.for === studentId) return;
    setEarned([]);
    setTesterStyles(null);
    status.current = { for: studentId, ok: false, busy: false };
  }, [studentId]);

  useEffect(() => {
    if (!status.current.ok) load();
  }, [load, revalidateKey]);

  const unlocked = useMemo(
    () => [DEFAULT_EFFECT_STYLE, ...earned.filter((id) => id !== DEFAULT_EFFECT_STYLE)],
    [earned],
  );
  // A style being tried counts only while the server says this is the dev environment.
  const testing =
    testerStyles && trying && (trying === DEFAULT_EFFECT_STYLE || testerStyles.includes(trying))
      ? trying
      : null;
  const styleId = testing ?? chooseEffectStyle(saved, unlocked);

  useEffect(() => {
    applyEffectStyle(document.documentElement, styleId);
  }, [styleId]);
  // Sounds and vibration follow the style (U's feedback packs; unknown ids get the default pack).
  useFeedbackStyle(styleId);

  const choose = useCallback((id: EffectStyleId) => {
    setSaved(id);
    saveEffectStyle(deviceStorage(), id);
  }, []);

  const tryStyle = useCallback((id: EffectStyleId) => {
    setTrying(id);
    saveTrying(deviceStorage(), id);
  }, []);
  const resetTrying = useCallback(() => {
    setTrying(null);
    saveTrying(deviceStorage(), null);
  }, []);
  const tester = useMemo<StyleTester | null>(
    () =>
      testerStyles
        ? {
            styles: [
              DEFAULT_EFFECT_STYLE,
              ...testerStyles.filter((id) => id !== DEFAULT_EFFECT_STYLE),
            ],
            trying: testing,
            tryStyle,
            reset: resetTrying,
          }
        : null,
    [testerStyles, testing, tryStyle, resetTrying],
  );

  const value = useMemo(
    () => ({ style: EFFECT_STYLES[styleId], styleId, unlocked, choose, refresh: load, tester }),
    [styleId, unlocked, choose, load, tester],
  );
  return <EffectStyleContext.Provider value={value}>{children}</EffectStyleContext.Provider>;
}

/** The active effect style (Doodle Diary outside a provider). */
export function useEffectStyle(): EffectStyleApi {
  return useContext(EffectStyleContext);
}
