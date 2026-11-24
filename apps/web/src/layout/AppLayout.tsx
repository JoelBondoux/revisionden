import { Outlet } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';

/** Layout for the main app pages: content plus the main navigation. */
export function AppLayout() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <BottomNav />
      <main id="main" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

/** Layout for focused screens (welcome, lessons): no navigation to distract. */
export function FocusLayout() {
  return (
    <main id="main" className="focus-main" tabIndex={-1}>
      <Outlet />
    </main>
  );
}
