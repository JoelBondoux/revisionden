import { useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigationType } from 'react-router-dom';

/** Where each visited screen was scrolled to, by history entry, for the back button. */
const savedScroll = new Map<string, number>();

/** Moves focus to the new screen's main heading (or the main area) without scrolling. */
function focusNewScreen() {
  const main = document.getElementById('main');
  const target = main?.querySelector<HTMLElement>('h1') ?? main;
  if (!target) return;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}

/**
 * Wraps every route. A new screen starts at the top with focus on its main heading, so screen
 * readers announce it; the back and forward buttons put the reader back where they were; a link
 * to a part of the page (`#id`) scrolls there; and a change of query on the same screen (a tab,
 * a chosen child) leaves the scroll position alone. The first screen when the app opens is left
 * to the browser.
 */
export function RouteChange() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previous = useRef<{ key: string; pathname: string } | null>(null);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = { key: location.key, pathname: location.pathname };
    if (!before) return;
    savedScroll.set(before.key, window.scrollY);

    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      document.getElementById(id)?.scrollIntoView();
      return;
    }
    if (navigationType === 'POP') {
      const y = savedScroll.get(location.key);
      if (y !== undefined) window.scrollTo(0, y);
      return;
    }
    if (location.pathname === before.pathname) return;
    window.scrollTo(0, 0);
    focusNewScreen();
  }, [location.key, location.pathname, location.hash, navigationType]);

  return <Outlet />;
}
