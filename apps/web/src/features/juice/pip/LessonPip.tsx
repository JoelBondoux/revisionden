import { PipHomeButton } from './PipHomeButton';
import { useShowsLessonPip } from './lessonPip';
import { usePipSubject } from './subject';

/**
 * Pip, the Home button, in a lesson's own header row (J14b). Showing him here is what tells the
 * layout to leave out its Pip row, so a lesson screen without this header (empty, finished) keeps
 * the layout's Pip and a way Home (J14c).
 */
export function LessonPip() {
  useShowsLessonPip();
  return <PipHomeButton subjectId={usePipSubject()} inLesson />;
}
