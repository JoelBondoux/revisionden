import { Outlet, useLocation } from 'react-router-dom';
import { PageTransition } from '../transitions/PageTransition';
import { EffectStyleProvider } from './EffectStyleProvider';

/** Screens that must make no API calls at all, signed in or out (Get help, workstream W). */
const QUIET_PATHS = new Set(['/help', '/parent/help']);

/**
 * The effect style for every screen (J10e). It sits inside the router so it knows the screen: it
 * asks for nothing on Get help, and retries a failed load when the screen changes. It also plays
 * the style's page transition when a button tile opens a page (J15a).
 */
export function EffectStyleRoute() {
  const { pathname } = useLocation();
  return (
    <EffectStyleProvider quiet={QUIET_PATHS.has(pathname)} revalidateKey={pathname}>
      <PageTransition />
      <Outlet />
    </EffectStyleProvider>
  );
}
