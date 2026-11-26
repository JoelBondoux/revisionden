import { useEffect, useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';

/** Where each visited screen was scrolled to, by history entry, for the back button. */
const savedScroll = new Map<string, number>();

/** How long to keep trying to restore a position while a screen loads its content. */
const RESTORE_WAIT_MS = 5000;

/** Moves focus to the new screen's main heading (or the main area) without scrolling. */
function focusNewScreen() {
  const main = document.getElementById('main');
  const target = main?.querySelector<HTMLElement>('h1') ?? main;
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

const reachable = (y: number) => document.documentElement.scrollHeight - window.innerHeight >= y;

/**
 * Scrolls back to `y`. A screen still loading its data may be too short to reach it, so keep
 * trying as its content arrives, until it fits, the reader scrolls themselves, or time runs out.
 * Returns a function that stops trying.
 */
function restoreScroll(y: number): () => void {
  window.scrollTo(0, y);
  if (reachable(y)) return () => {};
  const observer = new MutationObserver(() => {
    if (!reachable(y)) return;
    window.scrollTo(0, y);
    stop();
  });
  const userScrolls = ['wheel', 'touchstart', 'keydown'] as const;
  const timer = setTimeout(() => stop(), RESTORE_WAIT_MS);
  function stop() {
    observer.disconnect();
    clearTimeout(timer);
    for (const type of userScrolls) window.removeEventListener(type, stop);
  }
  observer.observe(document.body, { childList: true, subtree: true });
  for (const type of userScrolls) window.addEventListener(type, stop, { passive: true });
  return stop;
}

/**
 * Wraps every route. A new screen starts at the top with focus on its main heading, so screen
 * readers announce it; the back and forward buttons put the reader back where they were (waiting
 * for a loading screen's content if needed); a link to a part of the page (`#id`) scrolls there;
 * and a change of query on the same screen (a tab, a chosen child) leaves the scroll position
 * alone. The first screen when the app opens is left to the browser.
 */
export function RouteChange() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef<{ key: string; pathname: string } | null>(null);

  // Where the current screen is scrolled to, kept up to date as the reader scrolls, so it is
  // right even after the next screen has replaced it (and the window was clamped to a shorter
  // page) by the time the change is seen.
  const position = useRef(0);
  useEffect(() => {
    position.current = window.scrollY;
    const onScroll = () => {
      position.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = { key: location.key, pathname: location.pathname };
    if (!before) return;
    savedScroll.set(before.key, position.current);

    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      document.getElementById(id)?.scrollIntoView();
      return;
    }
    if (navigationType === 'POP') {
      const y = savedScroll.get(location.key);
      if (y === undefined) return;
      position.current = y;
      return restoreScroll(y);
    }
    if (location.pathname === before.pathname) return;
    window.scrollTo(0, 0);
    position.current = 0;
    focusNewScreen();
  }, [location.key, location.pathname, location.hash, navigationType]);

  return <Outlet />;
}
