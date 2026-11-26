import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LESSON_PATHS, isLessonPage } from './lessonRoutes';

// J14c (Codex review of train #355): one list of the lesson routes, so the layout's Pip row and
// the lesson avatar cover every screen that runs the lesson player, command words included.
describe('the lesson routes', () => {
  it('include every lesson screen, command words too', () => {
    for (const path of [
      '/learn/topic/t1',
      '/learn/daily',
      '/learn/subject/gcse-maths/practice',
      '/learn/subject/gcse-maths/start',
      '/learn/command-words',
    ])
      expect(isLessonPage(path), path).toBe(true);
    for (const path of ['/map', '/learn/subject/gcse-maths', '/learn/topic/t1/extra'])
      expect(isLessonPage(path), path).toBe(false);
  });

  it('are the paths the app routes use, so the two cannot drift apart', () => {
    const routes = readFileSync(join(import.meta.dirname, '../routes.tsx'), 'utf8');
    for (const [key, path] of Object.entries(LESSON_PATHS)) {
      expect(routes, key).toContain(`path: LESSON_PATHS.${key},`);
      expect(routes, path).not.toContain(`'${path}'`);
    }
  });
});
