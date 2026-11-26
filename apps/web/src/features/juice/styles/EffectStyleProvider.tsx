import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DEFAULT_EFFECT_STYLE,
  EFFECT_STYLES,
  applyEffectStyle,
  chooseEffectStyle,
  loadEffectStyle,
  saveEffectStyle,
} from './registry';
import type { EffectStyle, EffectStyleId, StyleStorage } from './registry';
import './sticker-book.css';

export interface EffectStyleApi {
  style: EffectStyle;
  styleId: EffectStyleId;
  /** Styles this child can use (Sticker Book is always one of them). */
  unlocked: readonly EffectStyleId[];
  choose(id: EffectStyleId): void;
}

const fallback: EffectStyleApi = {
  style: EFFECT_STYLES[DEFAULT_EFFECT_STYLE],
  styleId: DEFAULT_EFFECT_STYLE,
  unlocked: [DEFAULT_EFFECT_STYLE],
  choose: () => undefined,
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
  unlocked = [DEFAULT_EFFECT_STYLE],
}: {
  children: ReactNode;
  unlocked?: readonly EffectStyleId[];
}) {
  const [saved, setSaved] = useState<EffectStyleId>(() => loadEffectStyle(deviceStorage()));
  const styleId = chooseEffectStyle(saved, unlocked);

  useEffect(() => {
    applyEffectStyle(document.documentElement, styleId);
  }, [styleId]);

  const choose = useCallback((id: EffectStyleId) => {
    setSaved(id);
    saveEffectStyle(deviceStorage(), id);
  }, []);

  const value = useMemo(
    () => ({ style: EFFECT_STYLES[styleId], styleId, unlocked, choose }),
    [styleId, unlocked, choose],
  );
  return <EffectStyleContext.Provider value={value}>{children}</EffectStyleContext.Provider>;
}

/** The active effect style (Sticker Book outside a provider). */
export function useEffectStyle(): EffectStyleApi {
  return useContext(EffectStyleContext);
}
