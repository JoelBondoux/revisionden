import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { TILE_VIA } from '../../../components/links';
import './transitions.css';

/** Get help opens calmly and at once, however it is reached (owner rule). */
const CALM_PATHS = /^\/(parent\/)?help(\/|$)/;

/** Longest a transition may run (each style's stays at or under 350ms); then it is cleared. */
const CLEAR_AFTER_MS = 500;

const ENTER = 'page-enter';
const BACK = 'page-enter--back';

const browserReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const viaTile = (state: unknown) =>
  !!state && typeof state === 'object' && (state as { via?: unknown }).via === TILE_VIA;

/**
 * The effect style's page transition (J15a). When a button tile opens a page, the main area gets
 * `page-enter`, which each style's stylesheet animates (a page turn, a pop, a pixel wipe...). Back
 * from that page gets `page-enter page-enter--back`, the same move in reverse. It is only a short
 * CSS animation on the page itself, so taps are never blocked. Nothing plays for Get help, or when
 * the device asks for reduced motion: the page just swaps.
 */
export function PageTransition({
  reducedMotion = browserReducedMotion,
}: {
  reducedMotion?: () => boolean;
}) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousKey = useRef<string | null>(null);
  /** History entries that were opened from a tile, so Back from them reverses the move. */
  const fromTile = useRef(new Set<string>());

  useLayoutEffect(() => {
    const before = previousKey.current;
    previousKey.current = location.key;
    if (before === null) return;
    if (navigationType === 'PUSH' && viaTile(location.state)) fromTile.current.add(location.key);

    let direction: 'forward' | 'back' | null = null;
    if (navigationType === 'POP') {
      if (fromTile.current.has(before)) direction = 'back';
      else if (fromTile.current.has(location.key)) direction = 'forward';
    } else if (fromTile.current.has(location.key)) direction = 'forward';
    if (!direction || CALM_PATHS.test(location.pathname) || reducedMotion()) return;

    const main = document.getElementById('main');
    if (!main) return;
    main.classList.remove(ENTER, BACK);
    void main.offsetWidth; // restart the animation if one was still running
    main.classList.add(ENTER);
    if (direction === 'back') main.classList.add(BACK);
    const clear = () => main.classList.remove(ENTER, BACK);
    const onEnd = (event: AnimationEvent) => {
      if (event.target === main) clear();
    };
    main.addEventListener('animationend', onEnd);
    const timer = setTimeout(clear, CLEAR_AFTER_MS);
    return () => {
      main.removeEventListener('animationend', onEnd);
      clearTimeout(timer);
      clear();
    };
  }, [location.key, location.pathname, location.state, navigationType, reducedMotion]);

  return null;
}
