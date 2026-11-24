import { Navigate, type RouteObject } from 'react-router-dom';
import { AppLayout, FocusLayout } from './layout/AppLayout';
import { LinkPage } from './features/onboarding/LinkPage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { ComingSoon } from './pages/ComingSoon';
import { FamilyPage } from './pages/FamilyPage';
import { InstallHelpPage } from './pages/InstallHelpPage';
import { LessonCompletePage } from './pages/LessonCompletePage';
import { LessonPage } from './pages/LessonPage';
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

export const routes: RouteObject[] = [
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
      { path: '/family/:studentId/rewards', element: <ParentRewardsPage /> },
      { path: '/lesson/:lessonId', element: <LessonPage /> },
      { path: '/lesson/:lessonId/complete', element: <LessonCompletePage /> },
      { path: '/review', element: <ReviewQueuePage /> },
      { path: '/review/batches/:batchId', element: <BatchReviewPage /> },
      // Learning loop (workstream F): lessons and the starting test hide the nav.
      { path: '/learn/topic/:topicId', element: <TopicLessonPage /> },
      { path: '/learn/subject/:subjectId/practice', element: <SubjectPracticePage /> },
      { path: '/learn/subject/:subjectId/start', element: <StartingTestPage /> },
      { path: '/learn/command-words', element: <CommandWordsPage /> },
      // Policies, About and feedback (workstream L): policies are reachable without signing in.
      { path: '/legal', element: <LegalIndexPage /> },
      { path: '/legal/:name', element: <PolicyPage /> },
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
      {
        path: '/progress',
        element: (
          <ComingSoon title="Progress" description="Mastery per topic and your predicted grades." />
        ),
      },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/install', element: <InstallHelpPage /> },
      { path: '/about', element: <AboutPage /> },
      { path: '/feedback', element: <FeedbackPage /> },
      { path: '/feedback/family', element: <FeedbackListPage scope="family" /> },
      { path: '/feedback/mine', element: <FeedbackListPage scope="mine" /> },
    ],
  },
];
