import { Outlet } from 'react-router-dom';

/**
 * A calm, plain layout for Get help: no navigation, no sounds, no badges, and nothing that asks
 * the API for anything, so visiting the page makes no requests at all.
 */
export function HelpLayout() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <main id="main" className="help-main" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}
