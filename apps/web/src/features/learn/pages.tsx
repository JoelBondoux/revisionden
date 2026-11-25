import { useParams } from 'react-router-dom';
import { WEAK_SPOT_THRESHOLD } from '@revisionden/core';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { ButtonLink } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { ProgressBar } from '../../components/ProgressBar';
import { Link } from 'react-router-dom';
import { LearnItFirst, checkedLinksFor, learnLinksByTopic } from '../learn-links';
import { LessonPlayer } from './LessonPlayer';
import { subjectLabel, useLearnApi } from './learnApi';

/** A lesson on one topic: `/learn/topic/:topicId`. */
export function TopicLessonPage() {
  const { topicId = '' } = useParams();
  const api = useLearnApi();
  const lesson = useApiResource(() => api.getLesson({ topicId }), [api, topicId]);
  if (lesson.status !== 'ready') return <LoadingOrError resource={lesson} />;
  return (
    <>
      <LearnItFirst links={checkedLinksFor(learnLinksByTopic, topicId)} />
      <LessonPlayer
        key={topicId}
        title={lesson.data.items[0]?.topicTitle ?? 'Lesson'}
        items={lesson.data.items}
        draftContent={lesson.data.draftContent}
      />
    </>
  );
}

/** A mixed lesson across a subject, weak spots first: `/learn/subject/:subjectId/practice`. */
export function SubjectPracticePage() {
  const { subjectId = '' } = useParams();
  const api = useLearnApi();
  const lesson = useApiResource(() => api.getLesson({ subjectId }), [api, subjectId]);
  if (lesson.status !== 'ready') return <LoadingOrError resource={lesson} />;
  return (
    <LessonPlayer
      title={`${subjectLabel(subjectId)} practice`}
      items={lesson.data.items}
      draftContent={lesson.data.draftContent}
      doneHref={`/learn/subject/${subjectId}`}
    />
  );
}

/** Exam technique basics: `/learn/command-words`. */
export function CommandWordsPage() {
  const api = useLearnApi();
  const lesson = useApiResource(() => api.getCommandWords(), [api]);
  if (lesson.status !== 'ready') return <LoadingOrError resource={lesson} />;
  return (
    <LessonPlayer
      title="Command words"
      intro="Exam technique basics: learn what each command word asks you to do, so your answer gives the examiner what they are looking for."
      items={lesson.data.items}
      draftContent={lesson.data.draftContent}
    />
  );
}

/** A subject's topics with mastery, and the way into the starting test: `/learn/subject/:id`. */
export function SubjectPage() {
  const { subjectId = '' } = useParams();
  const api = useLearnApi();
  const topics = useApiResource(() => api.getSubjectTopics(subjectId), [api, subjectId]);
  const label = subjectLabel(subjectId);
  return (
    <div className="subject-page">
      <header className="page-header">
        <h1>{label}</h1>
      </header>
      {topics.status !== 'ready' ? (
        <LoadingOrError resource={topics} />
      ) : (
        <>
          <div className="subject-page__actions">
            {!topics.data.startingTestDone && (
              <ButtonLink to={`/learn/subject/${subjectId}/start`} block>
                Take the starting test (about 5 minutes)
              </ButtonLink>
            )}
            <ButtonLink to={`/learn/subject/${subjectId}/practice`} variant="secondary" block>
              Practise weak spots
            </ButtonLink>
            <ButtonLink to="/learn/command-words" variant="secondary" block>
              Command words
            </ButtonLink>
          </div>
          <ul className="topic-list">
            {topics.data.topics.map((topic) => (
              <li key={topic.topicId} className="topic-list__item">
                <div className="topic-list__head">
                  <Link to={`/learn/topic/${topic.topicId}`}>{topic.title}</Link>
                  {topic.mastery < WEAK_SPOT_THRESHOLD && <Pill tone="warning">Weak spot</Pill>}
                </div>
                <ProgressBar
                  label={`${topic.title} mastery`}
                  value={topic.mastery}
                  max={100}
                  valueText={`${topic.mastery}%`}
                  tone="success"
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
