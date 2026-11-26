import { matchPath } from 'react-router-dom';

/**
 * The screens that run the lesson player or the starting test (J14c): one list, used by the app's
 * routes and by the layout (Pip's row, the lesson avatar), so the two cannot drift apart.
 */
export const LESSON_PATHS = {
  topic: '/learn/topic/:topicId',
  daily: '/learn/daily',
  practice: '/learn/subject/:subjectId/practice',
  start: '/learn/subject/:subjectId/start',
  commandWords: '/learn/command-words',
} as const;

/** True on a lesson or test screen: Pip sits top left and asks before leaving (J15b). */
export function isLessonPage(pathname: string): boolean {
  return Object.values(LESSON_PATHS).some((path) => matchPath({ path, end: true }, pathname));
}
