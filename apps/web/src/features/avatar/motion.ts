import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * E9: how the student's avatar moves. "idle" is a slow loop (breathing, a blink now and then, a
 * small look around and bounce); the reactions play once and go back to idle. All motion is CSS
 * transforms on whole layer groups (see avatar.css), so it works whatever the avatar wears.
 */
export type AvatarReaction = 'nod' | 'hop' | 'hmm' | 'tap';
export type AvatarMotion = 'idle' | 'still' | AvatarReaction;

/** How long each reaction plays; matches the animation lengths in avatar.css. */
export const REACTION_MS: Record<AvatarReaction, number> = {
  nod: 700,
  hop: 900,
  hmm: 1400,
  tap: 450,
};

const browserReducedMotion = () => {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
};

interface Options {
  /** True during questions and Test mode: the idle loop stops, reactions still play. */
  paused?: boolean;
  reducedMotion?: () => boolean;
}

export interface AvatarMotionProps {
  motion: AvatarMotion;
  motionKey: number;
  paused: boolean;
}

/**
 * Props for AvatarSvg plus `react(kind)`: nod for a right answer, hop for a goal or level,
 * hmm for a wrong answer, tap when the avatar is tapped. With reduced motion the avatar stays still and reactions do nothing.
 */
export function useAvatarMotion({
  paused = false,
  reducedMotion = browserReducedMotion,
}: Options = {}) {
  const [reduced] = useState(reducedMotion);
  const [state, setState] = useState<{ motion: AvatarMotion; key: number }>({
    motion: reduced ? 'still' : 'idle',
    key: 0,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const react = useCallback(
    (kind: AvatarReaction) => {
      if (reduced) return;
      clearTimeout(timer.current);
      setState((s) => ({ motion: kind, key: s.key + 1 }));
      timer.current = setTimeout(
        () => setState((s) => ({ motion: 'idle', key: s.key })),
        REACTION_MS[kind],
      );
    },
    [reduced],
  );

  const props: AvatarMotionProps = { motion: state.motion, motionKey: state.key, paused };
  return { props, react };
}
