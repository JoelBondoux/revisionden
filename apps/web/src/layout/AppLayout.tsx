import { Outlet } from 'react-router-dom';
import { useApi } from '../api/ApiContext';
import { useApiResource } from '../api/useApiResource';
import { BottomNav } from '../components/BottomNav';
import { MuteButton } from '../features/sound';
import { OfflineBanner } from '../pwa/OfflineBanner';
import { useStudent } from '../session/StudentContext';

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
    </div>
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
    </>
  );
}
