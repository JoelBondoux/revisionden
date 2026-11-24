import { Navigate, type RouteObject } from 'react-router-dom';
import { AppLayout, FocusLayout } from './layout/AppLayout';
import { ComingSoon } from './pages/ComingSoon';
import { FamilyPage } from './pages/FamilyPage';
import { InstallHelpPage } from './pages/InstallHelpPage';
import { LessonCompletePage } from './pages/LessonCompletePage';
import { LessonPage } from './pages/LessonPage';
import { MapPage } from './pages/MapPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SettingsPage } from './pages/SettingsPage';
import { WelcomePage } from './pages/WelcomePage';
import { FlashcardsPage } from './features/flashcards/FlashcardsPage';
import {
  CommandWordsPage,
  SubjectPage,
  SubjectPracticePage,
  TopicLessonPage,
} from './features/learn/pages';
import { StartingTestPage } from './features/learn/StartingTestPage';

export const routes: RouteObject[] = [
  {
    element: <FocusLayout />,
    children: [
      { path: '/', element: <WelcomePage /> },
      { path: '/family', element: <FamilyPage /> },
      { path: '/lesson/:lessonId', element: <LessonPage /> },
      { path: '/lesson/:lessonId/complete', element: <LessonCompletePage /> },
      // Learning loop (workstream F): lessons and the starting test hide the nav.
      { path: '/learn/topic/:topicId', element: <TopicLessonPage /> },
      { path: '/learn/subject/:subjectId/practice', element: <SubjectPracticePage /> },
      { path: '/learn/subject/:subjectId/start', element: <StartingTestPage /> },
      { path: '/learn/command-words', element: <CommandWordsPage /> },
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
    ],
  },
];
