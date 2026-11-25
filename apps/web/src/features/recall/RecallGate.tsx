import { useState, type ReactNode } from 'react';
import { useApiResource } from '../../api/useApiResource';
import { Button } from '../../components/Button';
import { LessonPlayer } from '../learn/LessonPlayer';
import { useRecallApi } from './recallApi';

interface RecallGateProps {
  topicId: string;
  /** The lesson, shown after the recall check (or straight away when there is none). */
  children: ReactNode;
}

/**
 * Recall checks: on a topic practised before, 2 quick questions from earlier lessons come first
 * ("Remember this?"). No penalty (normal answers: a wrong one becomes a flashcard) and skippable.
 * If they cannot load, the lesson starts as normal.
 */
export function RecallGate({ topicId, children }: RecallGateProps) {
  const api = useRecallApi();
  const recall = useApiResource(() => api.getRecall(topicId), [api, topicId]);
  const [finished, setFinished] = useState(false);
  if (recall.status === 'loading') return null;
  if (finished || recall.status === 'error' || recall.data.items.length === 0)
    return <>{children}</>;
  return (
    <LessonPlayer
      key={`recall-${topicId}`}
      title="Remember this?"
      intro="2 quick questions from earlier lessons. No penalty: anything you miss becomes a flashcard."
      items={recall.data.items}
      draftContent={recall.data.draftContent}
      doneHref="/map"
      onFinish={() => setFinished(true)}
      aside={
        <Button
          variant="secondary"
          onClick={() => setFinished(true)}
          aria-label="Skip recall check"
        >
          Skip
        </Button>
      }
    />
  );
}
