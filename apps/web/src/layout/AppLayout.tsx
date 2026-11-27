import { Outlet, useLocation } from 'react-router-dom';
import { isLessonPage } from './lessonRoutes';
import { useApi } from '../api/ApiContext';
import { useApiResource } from '../api/useApiResource';
import { BottomNav } from '../components/BottomNav';
import { BugButton } from '../features/feedback/BugButton';
import { BugButtonProvider, useBugButtonVisible } from '../features/feedback/bugButtonContext';
import { RewardNotices } from '../features/feedback/RewardNotices';
import { MuteButton } from '../features/sound';
import { PipHomeButton, usePipSubject } from '../features/juice/pip';
import { useLessonShowsPip } from '../features/juice/pip/lessonPip';
import { OfflineBanner } from '../pwa/OfflineBanner';
import { useStudent } from '../session/StudentContext';
import { PublicHeader } from './PublicHeader';
import { VersionFooter } from './VersionFooter';
import { MyAvatarProvider, useMyAvatar } from '../features/me';
import { SubjectSwitcher } from '../features/subjects';

/**
 * UX-1: the screens whose top bar shows the current subject. The map shows its own (UX-2, with the
 * level), so there is exactly one subject control there.
 */
const showsSubject = (pathname: string) => /^\/(home|cards)\/?$/.test(pathname);

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

/** The chosen student's own avatar code for the Me nav item; null while loading or on error. */
function useMyAvatarCode(): string | null {
  return useMyAvatar()?.code ?? null;
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
  // The nav's Me item and the Me page share one avatar, so an edit shows everywhere at once (W9).
  return (
    <MyAvatarProvider studentId={studentId}>
      <StudentLayout />
    </MyAvatarProvider>
  );
}

function StudentLayout() {
  const { pathname } = useLocation();
  const cardsDue = useCardsDue();
  const avatarCode = useMyAvatarCode();
  const mainClass = useMainClass('app-main');
  const pipSubject = usePipSubject();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <OfflineBanner />
      <BottomNav cardsDue={cardsDue} avatarCode={avatarCode} />
      <main id="main" className={mainClass} tabIndex={-1}>
        <header className="sound-header">
          {/* Pip, the Home button, top left on every student screen (J15b). */}
          <PipHomeButton subjectId={pipSubject} />
          {showsSubject(pathname) && <SubjectSwitcher />}
          {/* UX-2: a screen's own top-bar item (the map's streak) is drawn here. */}
          <div id="top-bar-slot" className="top-bar-slot" />
          <MuteButton />
          {/* In the top row, not floating, so it never covers the page (docs/PRODUCT_RULES.md). */}
          <BugButton />
        </header>
        <Outlet />
      </main>
      {/* No Get help link here: it lives on Settings, reached from Me (owner, 2026-11-26). */}
      <VersionFooter />
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

/** Parent screens: the bug button goes in a top row there, so it never covers the page (I15). */
const isParentPage = (pathname: string) => /^\/(parent|family)(\/|$)/.test(pathname);

function FocusPages() {
  const { pathname } = useLocation();
  const topRow = isParentPage(pathname);
  const lesson = isLessonPage(pathname);
  const { studentId } = useStudent();
  const lessonShowsPip = useLessonShowsPip();
  const pipSubject = usePipSubject();
  const floatingClass = useMainClass('focus-main');
  const mainClass = topRow ? 'focus-main' : floatingClass;
  return (
    <>
      <OfflineBanner />
      <main id="main" className={mainClass} tabIndex={-1}>
        {topRow && (
          <header className="parent-top-row">
            <BugButton />
          </header>
        )}
        {/* While the lesson itself shows Pip in its header (J14b), this row steps aside. */}
        {lesson && !lessonShowsPip && (
          <header className="lesson-top-row">
            <PipHomeButton subjectId={pipSubject} inLesson />
          </header>
        )}
        {/* J14b: lessons show the student's avatar beside Pip's line, so they load it. */}
        {lesson && studentId ? (
          <MyAvatarProvider studentId={studentId}>
            <Outlet />
          </MyAvatarProvider>
        ) : (
          <Outlet />
        )}
      </main>
      <VersionFooter />
      {!topRow && <BugButton />}
    </>
  );
}
