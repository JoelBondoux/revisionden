import { Navigate, useParams, type RouteObject } from 'react-router-dom';
import { LESSON_PATHS } from './layout/lessonRoutes';
import { AppLayout, FocusLayout } from './layout/AppLayout';
import { HomePage } from './features/home/HomePage';
import { RouteChange } from './layout/RouteChange';
import { LinkPage } from './features/onboarding/LinkPage';
import { UnlockPage } from './features/onboarding/UnlockPage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { SubjectsPage } from './features/onboarding/SubjectsPage';
import { ComingSoon } from './pages/ComingSoon';
import { FamilyPage } from './pages/FamilyPage';
import { InstallHelpPage } from './pages/InstallHelpPage';
import { MapPage } from './pages/MapPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LookAndSoundPage, MoreSettingsPage, SettingsPage } from './pages/SettingsPage';
import { WelcomePage } from './pages/WelcomePage';
import { BatchReviewPage } from './features/review/BatchReviewPage';
import { ReviewQueuePage } from './features/review/ReviewQueuePage';
import { FlashcardsPage } from './features/flashcards/FlashcardsPage';
import { PastPapersPage } from './features/past-papers';
import {
  CommandWordsPage,
  SubjectPage,
  SubjectPracticePage,
  TopicLessonPage,
} from './features/learn/pages';
import { StartingTestPage } from './features/learn/StartingTestPage';
import { DailyPage } from './features/daily';
import { ParentRewardsPage, RewardsPage } from './features/rewards';
import { LegalIndexPage, PolicyPage } from './features/legal/pages';
import { PolicyGate } from './features/legal/acceptance';
import { YoungPeopleNoticePage } from './features/legal/youngPeopleNotice';
import { AboutPage } from './features/about/AboutPage';
import { FeedbackPage } from './features/feedback/FeedbackPage';
import { AdminFeedbackPage, FeedbackListPage } from './features/feedback/lists';
import { MyStatsPage } from './features/stats/MyStatsPage';
import { ParentDashboardPage } from './features/stats/ParentDashboardPage';
import { ParentHomePage, ParentRemindersPage } from './features/parent';
import { LeaguePage, ParentFriendsPage } from './features/league';
import { ComplaintsPage } from './features/complaints/ComplaintsPage';
import { AskParentPage } from './features/complaints/AskParentPage';
import { JoinPage } from './features/parents';
import { HelpLayout, HelpPage } from './features/help';
import { EffectStyleRoute } from './features/juice/styles';

function LessonRedirect() {
  const { lessonId = '' } = useParams();
  return <Navigate to={`/learn/topic/${encodeURIComponent(lessonId)}`} replace />;
}

/** Every screen, inside `RouteChange` (scroll to top and focus on a new screen, I7). */
const screens: RouteObject[] = [
  {
    // Get help (workstream W): a calm page with no navigation and no API calls, signed in or out.
    element: <HelpLayout />,
    children: [
      { path: '/help', element: <HelpPage audience="student" /> },
      { path: '/parent/help', element: <HelpPage audience="parent" /> },
    ],
  },
  {
    element: <FocusLayout />,
    children: [
      { path: '/', element: <WelcomePage /> },
      { path: '/family', element: <FamilyPage /> },
      {
        path: '/onboarding',
        element: (
          <PolicyGate>
            <OnboardingPage />
          </PolicyGate>
        ),
      },
      { path: '/link', element: <LinkPage /> },
      // Student passkey unlock (I5): after the 12-hour device session runs out.
      { path: '/unlock', element: <UnlockPage /> },
      // Two parents (B3): the second parent joins with the invite code.
      { path: '/join', element: <JoinPage /> },
      { path: '/family/:studentId/rewards', element: <ParentRewardsPage /> },
      // Old topic map links: the lesson player is /learn/topic/:topicId (workstream F).
      { path: '/lesson/:lessonId', element: <LessonRedirect /> },
      { path: '/lesson/:lessonId/complete', element: <Navigate to="/map" replace /> },
      { path: '/review', element: <ReviewQueuePage /> },
      // Parent home (workstream P): the way in to the parent pages.
      { path: '/parent', element: <ParentHomePage /> },
      { path: '/parent/reminders/:studentId', element: <ParentRemindersPage /> },
      { path: '/parent/friends/:studentId', element: <ParentFriendsPage /> },
      { path: '/parent/stats', element: <ParentDashboardPage /> },
      // A child's subjects after onboarding (workstream E5).
      { path: '/parent/subjects/:studentId', element: <SubjectsPage /> },
      // Formal complaints (workstream O4).
      { path: '/complaints', element: <ComplaintsPage /> },
      { path: '/ask-a-parent', element: <AskParentPage /> },
      { path: '/review/batches/:batchId', element: <BatchReviewPage /> },
      // Learning loop (workstream F): lessons and the starting test hide the nav.
      { path: LESSON_PATHS.topic, element: <TopicLessonPage /> },
      // Daily 5-a-day (workstream Q), in the lesson player.
      { path: LESSON_PATHS.daily, element: <DailyPage /> },
      { path: LESSON_PATHS.practice, element: <SubjectPracticePage /> },
      { path: LESSON_PATHS.start, element: <StartingTestPage /> },
      { path: LESSON_PATHS.commandWords, element: <CommandWordsPage /> },
      // Policies, About and feedback (workstream L): policies are reachable without signing in.
      { path: '/welcome/privacy', element: <YoungPeopleNoticePage /> },
      { path: '/admin/feedback', element: <AdminFeedbackPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: '/home', element: <HomePage /> },
      { path: '/map', element: <MapPage /> },
      { path: '/learn', element: <Navigate to="/home" replace /> },
      { path: '/learn/subject/:subjectId', element: <SubjectPage /> },
      // Past papers (Q7): links to each exam board's own past-paper finder.
      { path: '/learn/subject/:subjectId/past-papers', element: <PastPapersPage /> },
      { path: '/cards', element: <FlashcardsPage /> },
      { path: '/rewards', element: <RewardsPage /> },
      { path: '/league', element: <LeaguePage /> },
      {
        path: '/plan',
        element: (
          <ComingSoon title="Plan" description="Your weekly study plan, built around your exams." />
        ),
      },
      {
        path: '/papers',
        element: (
          <ComingSoon title="Papers" description="Past papers with a timer and mark schemes." />
        ),
      },
      // Statistics dashboards (workstream K): My stats, reached from "My progress" on Me (W7).
      { path: '/progress', element: <MyStatsPage /> },
      // Me (W9): the main page plus two sub-pages, so the main one fits one phone screen.
      { path: '/settings', element: <SettingsPage /> },
      { path: '/settings/look-and-sound', element: <LookAndSoundPage /> },
      { path: '/settings/more', element: <MoreSettingsPage /> },
      { path: '/install', element: <InstallHelpPage /> },
      { path: '/about', element: <AboutPage /> },
      // Policies are reachable without signing in (workstream L).
      { path: '/legal', element: <LegalIndexPage /> },
      { path: '/legal/:name', element: <PolicyPage /> },
      { path: '/feedback', element: <FeedbackPage /> },
      { path: '/feedback/family', element: <FeedbackListPage scope="family" /> },
      { path: '/feedback/mine', element: <FeedbackListPage scope="mine" /> },
    ],
  },
];

/** The effect style wraps every screen (J10e) and knows which one is showing. */
export const routes: RouteObject[] = [
  { element: <EffectStyleRoute />, children: [{ element: <RouteChange />, children: screens }] },
];
