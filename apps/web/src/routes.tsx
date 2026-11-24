import type { RouteObject } from 'react-router-dom';
import { AppLayout, FocusLayout } from './layout/AppLayout';
import { ComingSoon } from './pages/ComingSoon';
import { FamilyPage } from './pages/FamilyPage';
import { InstallHelpPage } from './pages/InstallHelpPage';
import { LessonCompletePage } from './pages/LessonCompletePage';
import { LessonPage } from './pages/LessonPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PathPage } from './pages/PathPage';
import { SettingsPage } from './pages/SettingsPage';
import { WelcomePage } from './pages/WelcomePage';

export const routes: RouteObject[] = [
  {
    element: <FocusLayout />,
    children: [
      { path: '/', element: <WelcomePage /> },
      { path: '/family', element: <FamilyPage /> },
      { path: '/lesson/:lessonId', element: <LessonPage /> },
      { path: '/lesson/:lessonId/complete', element: <LessonCompletePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: '/learn', element: <PathPage /> },
      {
        path: '/cards',
        element: <ComingSoon title="Cards" description="Flashcards that come back just in time." />,
      },
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
