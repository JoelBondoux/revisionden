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
}

const fallback: EffectStyleApi = {
  style: EFFECT_STYLES[DEFAULT_EFFECT_STYLE],
  styleId: DEFAULT_EFFECT_STYLE,
  unlocked: [DEFAULT_EFFECT_STYLE],
  choose: () => undefined,
  refresh: () => undefined,
};

const EffectStyleContext = createContext<EffectStyleApi>(fallback);

function deviceStorage(): StyleStorage | null {
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
  loadUnlocked?: () => Promise<readonly string[]>;
  /** True on screens that must make no API calls (Get help): nothing is loaded while quiet. */
  quiet?: boolean;
  /** Changes with each screen; a load that failed (say, before unlocking) is tried again. */
  revalidateKey?: string;
}) {
  const { studentId } = useStudent();
  const [saved, setSaved] = useState<EffectStyleId>(() => loadEffectStyle(deviceStorage()));
  const [earned, setEarned] = useState<readonly EffectStyleId[]>([]);
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
      .then((ids) => {
        if (status.current.for !== forStudent) return;
        status.current = { for: forStudent, ok: true, busy: false };
        setEarned(ids.filter(isEffectStyleId));
      })
      .catch(() => {
        if (status.current.for === forStudent) status.current.busy = false;
      });
  }, [studentId, quiet, loadUnlocked]);

  // A new student starts from nothing; load for them as soon as the screen allows.
  useEffect(() => {
    if (status.current.for === studentId) return;
    setEarned([]);
    status.current = { for: studentId, ok: false, busy: false };
  }, [studentId]);

  useEffect(() => {
    if (!status.current.ok) load();
  }, [load, revalidateKey]);

  const unlocked = useMemo(
    () => [DEFAULT_EFFECT_STYLE, ...earned.filter((id) => id !== DEFAULT_EFFECT_STYLE)],
    [earned],
  );
  const styleId = chooseEffectStyle(saved, unlocked);

  useEffect(() => {
    applyEffectStyle(document.documentElement, styleId);
  }, [styleId]);
  // Sounds and vibration follow the style (U's feedback packs; unknown ids get the default pack).
  useFeedbackStyle(styleId);

  const choose = useCallback((id: EffectStyleId) => {
    setSaved(id);
    saveEffectStyle(deviceStorage(), id);
  }, []);

  const value = useMemo(
    () => ({ style: EFFECT_STYLES[styleId], styleId, unlocked, choose, refresh: load }),
    [styleId, unlocked, choose, load],
  );
  return <EffectStyleContext.Provider value={value}>{children}</EffectStyleContext.Provider>;
}

/** The active effect style (Doodle Diary outside a provider). */
export function useEffectStyle(): EffectStyleApi {
  return useContext(EffectStyleContext);
}
