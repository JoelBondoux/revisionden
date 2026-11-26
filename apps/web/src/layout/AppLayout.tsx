import { Outlet } from 'react-router-dom';
import { useApi } from '../api/ApiContext';
import { useApiResource } from '../api/useApiResource';
import { BottomNav } from '../components/BottomNav';
import { BugButton } from '../features/feedback/BugButton';
import { BugButtonProvider, useBugButtonVisible } from '../features/feedback/bugButtonContext';
import { RewardNotices } from '../features/feedback/RewardNotices';
import { MuteButton } from '../features/sound';
import { OfflineBanner } from '../pwa/OfflineBanner';
import { useStudent } from '../session/StudentContext';
import { PublicHeader } from './PublicHeader';
import { VersionFooter } from './VersionFooter';
import { GetHelpLink } from '../features/help';

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

/** Marks the main area while the bug button is showing (focused and public pages pad it). */
function useMainClass(base: string): string {
  return useBugButtonVisible() ? `${base} has-bug-button` : base;
}

/** Layout for the main app pages: content plus the main navigation. */
export function AppLayout() {
  return (
    <BugButtonProvider>
      <AppPages />
    </BugButtonProvider>
  );
}

function AppPages() {
  const { studentId } = useStudent();
  // Only a student's linked device gets the student app nav; anyone else (signed out, or a
  // parent) gets the small public header on these pages.
  if (!studentId) return <PublicLayout />;
  return <StudentLayout />;
}

function StudentLayout() {
  const cardsDue = useCardsDue();
  const mainClass = useMainClass('app-main');
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <OfflineBanner />
      <BottomNav cardsDue={cardsDue} />
      <main id="main" className={mainClass} tabIndex={-1}>
        <header className="sound-header">
          <GetHelpLink />
          <MuteButton />
          {/* In the top row, not floating, so it never covers the page (docs/PRODUCT_RULES.md). */}
          <BugButton />
        </header>
        <Outlet />
      </main>
      <VersionFooter showHelp />
      <RewardNotices />
    </div>
  );
}

/** Public pages (About, policies, feedback) when no student uses this device. */
function PublicLayout() {
  const mainClass = useMainClass('focus-main');
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <OfflineBanner />
      <PublicHeader />
      <main id="main" className={mainClass} tabIndex={-1}>
        <Outlet />
      </main>
      <VersionFooter />
      <BugButton />
    </>
  );
}

/** Layout for focused screens (welcome, lessons): no navigation to distract. */
export function FocusLayout() {
  return (
    <BugButtonProvider>
      <FocusPages />
    </BugButtonProvider>
  );
}

function FocusPages() {
  const mainClass = useMainClass('focus-main');
  return (
    <>
      <OfflineBanner />
      <main id="main" className={mainClass} tabIndex={-1}>
        <Outlet />
      </main>
      <VersionFooter />
      <BugButton />
    </>
  );
}
