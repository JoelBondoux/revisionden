import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { StartingTestResponse, StartingTestResult } from '@revisionden/core';
import { ApiError } from '../../api/client';
import { ErrorRef, refOf } from '../../api/ErrorRef';
import { Button, ButtonLink } from '../../components/Button';
import { Card } from '../../components/Card';
import { ProgressBar } from '../../components/ProgressBar';
import { useSound } from '../sound';
import { useLearnApi } from './learnApi';
import { DraftBanner, ItemInput, toAnswer, type Draft } from './parts';

const clockText = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} left`;

function Results({
  result,
  timeUp,
  subjectId,
}: {
  result: StartingTestResult;
  timeUp: boolean;
  subjectId: string;
}) {
  const { play } = useSound();
  useEffect(() => void play('reveal', { mode: 'test' }), [play]);
  return (
    <div className="complete">
      <Card title="Your starting point">
        {timeUp && <p>Time is up, so we marked what you answered.</p>}
        <p>
          You got {result.correct} of {result.total} right.
        </p>
        <ul className="topic-list">
          {result.topics.map((topic) => (
            <li key={topic.topicId} className="topic-list__item">
              <span>{topic.title}</span>
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
        <ButtonLink to={`/learn/subject/${subjectId}`} block>
          Start learning
        </ButtonLink>
      </Card>
    </div>
  );
}

function Runner({
  test,
  onFinished,
}: {
  test: StartingTestResponse;
  onFinished: (result: StartingTestResult, timeUp: boolean) => void;
}) {
  const api = useLearnApi();
  const { play } = useSound();
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ ref: string | undefined } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(test.timeLimitSeconds);
  const startedAt = useRef(Date.now());
  const shownAt = useRef(Date.now());
  const finishing = useRef(false);
  const warned = useRef(false);

  const finish = useCallback(
    async (timeUp: boolean) => {
      if (finishing.current) return;
      finishing.current = true;
      try {
        onFinished(await api.finishStartingTest(test.id), timeUp);
      } catch (err) {
        finishing.current = false;
        setError({ ref: refOf(err) });
      }
    },
    [api, onFinished, test.id],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const left = Math.max(
        0,
        test.timeLimitSeconds - Math.floor((Date.now() - startedAt.current) / 1000),
      );
      setSecondsLeft(left);
      if (left <= 60 && !warned.current && test.timeLimitSeconds > 60) {
        warned.current = true;
        play('timerWarning', { mode: 'test' });
      }
      if (left === 0) void finish(true);
    }, 250);
    return () => clearInterval(timer);
  }, [finish, play, test.timeLimitSeconds]);

  const item = test.items[index]!;
  const isLast = index === test.items.length - 1;
  const answer = toAnswer(item, draft);

  async function next(skip: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (!skip && answer !== null) {
        play('submit', { mode: 'test' });
        await api.submitAttempt({
          itemId: item.id,
          answer,
          timeMs: Math.max(0, Date.now() - shownAt.current),
          mode: 'test',
          startingTestId: test.id,
        });
      }
      if (isLast) {
        await finish(false);
      } else {
        setIndex(index + 1);
        setDraft(null);
        shownAt.current = Date.now();
      }
    } catch (err) {
      setError({ ref: refOf(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lesson">
      <div className="lesson__top">
        <ProgressBar label="Test progress" tone="success" value={index} max={test.items.length} />
        <span className={`timer${secondsLeft <= 60 ? ' timer--warning' : ''}`} aria-live="off">
          {clockText(secondsLeft)}
        </span>
      </div>
      {test.draftContent && <DraftBanner />}
      <h1>Starting test</h1>
      <ItemInput key={item.id} item={item} draft={draft} disabled={busy} onChange={setDraft} />
      <div className="lesson__footer">
        {error && (
          <div role="alert" className="feedback feedback--wrong">
            <p>Something went wrong. Please try again.</p>
            <ErrorRef code={error.ref} />
          </div>
        )}
        <div className="self-check">
          <Button variant="secondary" disabled={busy} onClick={() => void next(true)}>
            Skip
          </Button>
          <Button disabled={busy || answer === null} onClick={() => void next(false)}>
            {isLast ? 'Finish' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The starting test for a subject (about 5 minutes, Test mode: no feedback until the end).
 * Its answers set the first mastery for each topic.
 */
export function StartingTestPage() {
  const { subjectId = '' } = useParams();
  const api = useLearnApi();
  const [test, setTest] = useState<StartingTestResponse | null>(null);
  const [problem, setProblem] = useState<{ text: string; ref?: string } | null>(null);
  const [outcome, setOutcome] = useState<{ result: StartingTestResult; timeUp: boolean } | null>(
    null,
  );
  const onFinished = useCallback(
    (result: StartingTestResult, timeUp: boolean) => setOutcome({ result, timeUp }),
    [],
  );

  async function start() {
    setProblem(null);
    try {
      setTest(await api.startStartingTest(subjectId));
    } catch (err) {
      setProblem(
        err instanceof ApiError && err.status === 404
          ? {
              text: 'No questions are ready for this subject yet. Every question is checked first.',
            }
          : { text: 'Something went wrong. Please try again.', ref: refOf(err) },
      );
    }
  }

  if (outcome) return <Results {...outcome} subjectId={subjectId} />;
  if (test) return <Runner test={test} onFinished={onFinished} />;
  return (
    <div className="lesson">
      <h1>Starting test</h1>
      <Card>
        <p>
          This takes about 5 minutes. Answer what you can and skip what you don&apos;t know. Your
          results come at the end and set where you start.
        </p>
        {problem && (
          <div role="alert" className="feedback feedback--wrong">
            <p>{problem.text}</p>
            <ErrorRef code={problem.ref} />
          </div>
        )}
        <Button block onClick={() => void start()}>
          Start
        </Button>
      </Card>
    </div>
  );
}
