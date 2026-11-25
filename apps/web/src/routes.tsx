import { Navigate, useParams, type RouteObject } from 'react-router-dom';
import { AppLayout, FocusLayout } from './layout/AppLayout';
import { LinkPage } from './features/onboarding/LinkPage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { ComingSoon } from './pages/ComingSoon';
import { FamilyPage } from './pages/FamilyPage';
import { InstallHelpPage } from './pages/InstallHelpPage';
import { MapPage } from './pages/MapPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SettingsPage } from './pages/SettingsPage';
import { WelcomePage } from './pages/WelcomePage';
import { BatchReviewPage } from './features/review/BatchReviewPage';
import { ReviewQueuePage } from './features/review/ReviewQueuePage';
import { FlashcardsPage } from './features/flashcards/FlashcardsPage';
import {
  CommandWordsPage,
  SubjectPage,
  SubjectPracticePage,
  TopicLessonPage,
} from './features/learn/pages';
import { StartingTestPage } from './features/learn/StartingTestPage';
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
import { JoinPage } from './features/parents';
import { HelpLayout, HelpPage } from './features/help';

function LessonRedirect() {
  const { lessonId = '' } = useParams();
  return <Navigate to={`/learn/topic/${encodeURIComponent(lessonId)}`} replace />;
}

export const routes: RouteObject[] = [
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
      { path: '/parent/stats', element: <ParentDashboardPage /> },
      { path: '/review/batches/:batchId', element: <BatchReviewPage /> },
      // Learning loop (workstream F): lessons and the starting test hide the nav.
      { path: '/learn/topic/:topicId', element: <TopicLessonPage /> },
      { path: '/learn/subject/:subjectId/practice', element: <SubjectPracticePage /> },
      { path: '/learn/subject/:subjectId/start', element: <StartingTestPage /> },
      { path: '/learn/command-words', element: <CommandWordsPage /> },
      // Policies, About and feedback (workstream L): policies are reachable without signing in.
      { path: '/welcome/privacy', element: <YoungPeopleNoticePage /> },
      { path: '/admin/feedback', element: <AdminFeedbackPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: '/map', element: <MapPage /> },
      { path: '/learn', element: <Navigate to="/map" replace /> },
      { path: '/learn/subject/:subjectId', element: <SubjectPage /> },
      { path: '/cards', element: <FlashcardsPage /> },
      { path: '/rewards', element: <RewardsPage /> },
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
      // Statistics dashboards (workstream K): My stats lives on the Progress tab.
      { path: '/progress', element: <MyStatsPage /> },
      { path: '/settings', element: <SettingsPage /> },
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
