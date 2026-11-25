import { Outlet } from 'react-router-dom';
import { useApi } from '../api/ApiContext';
import { useApiResource } from '../api/useApiResource';
import { BottomNav } from '../components/BottomNav';
import { MuteButton } from '../features/sound';
import { OfflineBanner } from '../pwa/OfflineBanner';
import { useStudent } from '../session/StudentContext';
import { PublicHeader } from './PublicHeader';
import { VersionFooter } from './VersionFooter';

/** Flashcards due for the chosen student; zero while loading, on error or with nobody chosen. */
function useCardsDue(): number {
  const api = useApi();
  const { studentId } = useStudent();
  const cards = useApiResource(
    () => (studentId ? api.getCardsDue() : Promise.resolve({ due: 0 })),
    [api, studentId],
  );
  return cards.status === 'ready' ? cards.data.due : 0;
}

/** Layout for the main app pages: content plus the main navigation. */
export function AppLayout() {
  const { studentId } = useStudent();
  // Only a student's linked device gets the student app nav; anyone else (signed out, or a
  // parent) gets the small public header on these pages.
  if (!studentId) return <PublicLayout />;
  return <StudentLayout />;
}

function StudentLayout() {
  const cardsDue = useCardsDue();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <OfflineBanner />
      <BottomNav cardsDue={cardsDue} />
      <main id="main" className="app-main" tabIndex={-1}>
        <header className="sound-header">
          <MuteButton />
        </header>
        <Outlet />
      </main>
      <VersionFooter />
    </div>
  );
}

/** Public pages (About, policies, feedback) when no student uses this device. */
function PublicLayout() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <OfflineBanner />
      <PublicHeader />
      <main id="main" className="focus-main" tabIndex={-1}>
        <Outlet />
      </main>
      <VersionFooter />
    </>
  );
}

/** Layout for focused screens (welcome, lessons): no navigation to distract. */
export function FocusLayout() {
  return (
    <>
      <OfflineBanner />
      <main id="main" className="focus-main" tabIndex={-1}>
        <Outlet />
      </main>
      <VersionFooter />
    </>
  );
}
