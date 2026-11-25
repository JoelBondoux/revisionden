import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { LearnAttemptResponse, LearnItem, Progress } from '@revisionden/core';
import { Button, ButtonLink } from '../../components/Button';
import { Card } from '../../components/Card';
import { CloseIcon } from '../../components/icons';
import { ProgressBar } from '../../components/ProgressBar';
import { ReadAloudButton, itemSpeechText } from '../read-aloud';
import { markSound, useSound } from '../sound';
import { useLearnApi } from './learnApi';
import { DailyGoal, DraftBanner, ItemInput, toAnswer, type Answer, type Draft } from './parts';

/** What read aloud says for the feedback box: the verdict, the answer and the explanation. */
function feedbackSpeech(result: LearnAttemptResponse): string {
  const feedback = result.feedback;
  const parts = [result.correct ? 'Correct!' : 'Not quite.'];
  if (!result.correct && feedback) parts.push(`Answer: ${feedback.correctAnswer}.`);
  if (feedback?.explanation) parts.push(feedback.explanation);
  return parts.join(' ');
}

function Feedback({ result }: { result: LearnAttemptResponse }) {
  const feedback = result.feedback;
  const wrongLine = feedback?.firstWrongLine;
  return (
    <div
      className={`feedback feedback--${result.correct ? 'correct' : 'wrong'}`}
      role="status"
      aria-label="Answer feedback"
    >
      <div className="read-aloud-row">
        <p className="feedback__title">{result.correct ? 'Correct!' : 'Not quite'}</p>
        <ReadAloudButton text={feedbackSpeech(result)} label="Read the feedback aloud" />
      </div>
      {result.correct ? (
        <p>+{result.xpEarned} XP</p>
      ) : (
        feedback && <p>Answer: {feedback.correctAnswer}</p>
      )}
      {!result.correct && typeof wrongLine === 'number' && (
        <p>Line {wrongLine + 1} is where it first goes wrong.</p>
      )}
      {feedback?.explanation && <p>{feedback.explanation}</p>}
      {result.flashcardAdded && <p>Added to your flashcards for another go later.</p>}
    </div>
  );
}

interface LessonPlayerProps {
  title: string;
  items: LearnItem[];
  draftContent: boolean;
  intro?: string;
  doneHref?: string;
}

/** Runs a lesson in Learn mode: every answer is marked straight away (feedback level 1). */
export function LessonPlayer({
  title,
  items,
  draftContent,
  intro,
  doneHref = '/learn',
}: LessonPlayerProps) {
  const api = useLearnApi();
  const { play } = useSound();
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(null);
  const [result, setResult] = useState<LearnAttemptResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [totals, setTotals] = useState({ correct: 0, marked: 0, xp: 0 });
  const [done, setDone] = useState(false);
  const shownAt = useRef(Date.now());

  useEffect(() => {
    let live = true;
    api.getProgress().then(
      (p) => live && setProgress((current) => current ?? p),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [api]);

  if (items.length === 0) {
    return (
      <Card title={title}>
        <p>No questions are ready here yet. Every question is checked before it appears.</p>
        <ButtonLink to={doneHref}>Back</ButtonLink>
      </Card>
    );
  }

  const item = items[index]!;
  const isLast = index === items.length - 1;
  const answer = toAnswer(item, draft);

  async function submit(value: Answer) {
    setChecking(true);
    setError(false);
    try {
      const marked = await api.submitAttempt({
        itemId: item.id,
        answer: value,
        timeMs: Math.max(0, Date.now() - shownAt.current),
        mode: 'learn',
      });
      play(markSound(marked));
      if (marked.progress.goalMet && progress && !progress.goalMet)
        play('streakDay', { delay: 0.4 });
      setResult(marked);
      setProgress(marked.progress);
      setTotals((t) => ({
        correct: t.correct + (marked.correct ? 1 : 0),
        marked: t.marked + 1,
        xp: t.xp + marked.xpEarned,
      }));
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  }

  function check(event: FormEvent) {
    event.preventDefault();
    if (answer !== null) void submit(answer);
  }

  function advance() {
    if (isLast) {
      play('celebration');
      setDone(true);
      return;
    }
    setIndex(index + 1);
    setDraft(null);
    setResult(null);
    shownAt.current = Date.now();
  }

  if (done) {
    return (
      <div className="complete">
        <Card title="Lesson complete">
          <div className="complete__stats">
            <div className="stat stat--success">
              <span className="stat__label">Right answers</span>
              <span className="stat__value">
                {totals.correct} of {totals.marked}
              </span>
            </div>
            <div className="stat stat--gold">
              <span className="stat__label">XP earned</span>
              <span className="stat__value">+{totals.xp} XP</span>
            </div>
          </div>
          {progress && <DailyGoal progress={progress} />}
          <ButtonLink to={doneHref} block>
            Done
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const unmarked = item.type === 'extended_answer';
  return (
    <form className="lesson" onSubmit={check}>
      <div className="lesson__top">
        <Link to={doneHref} className="icon-button" aria-label="Leave lesson">
          <CloseIcon />
        </Link>
        <ProgressBar
          label="Lesson progress"
          tone="success"
          value={index + (result || unmarked ? 1 : 0)}
          max={items.length}
        />
      </div>
      {draftContent && <DraftBanner />}
      <h1>{title}</h1>
      {intro && <p className="secondary-text">{intro}</p>}
      {progress && <DailyGoal progress={progress} />}
      <ReadAloudButton text={itemSpeechText(item)} label="Read the question aloud" />
      <ItemInput
        key={item.id}
        item={item}
        draft={draft}
        disabled={result !== null || checking}
        onChange={setDraft}
        onSelfCheck={(knewIt) => void submit(knewIt)}
      />
      <div className="lesson__footer">
        {error && (
          <p role="alert" className="feedback feedback--wrong">
            Couldn&apos;t check that answer. Please try again.
          </p>
        )}
        {result && <Feedback result={result} />}
        {result || unmarked ? (
          <Button block variant={result?.correct ? 'success' : 'primary'} onClick={advance}>
            {isLast ? 'Finish' : 'Continue'}
          </Button>
        ) : (
          item.type !== 'flashcard' && (
            <Button block type="submit" disabled={answer === null || checking}>
              Check
            </Button>
          )
        )}
      </div>
    </form>
  );
}
