import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import type {
  RewardCardResponse,
  StartingTestResponse,
  StartingTestResult,
} from '@revisionden/core';
import { ApiError } from '../../api/client';
import { ErrorRef, refOf, type ErrorDetails } from '../../api/ErrorRef';
import { Button, ButtonLink } from '../../components/Button';
import { Card } from '../../components/Card';
import { ProgressBar } from '../../components/ProgressBar';
import { useHideBugButton } from '../feedback/bugButtonContext';
import { ArenaProgress } from '../juice';
import { useSound } from '../sound';
import { useLearnApi } from './learnApi';
import { NewRewards } from './NewRewards';
import { DraftBanner, ItemInput, toAnswer, type Draft } from './parts';

const clockText = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} left`;

type Outcome = { result: StartingTestResult; timeUp: boolean; earned: RewardCardResponse[] };

function Results({ result, timeUp, earned, subjectId }: Outcome & { subjectId: string }) {
  const { play } = useSound();
  useEffect(() => void play('reveal', { mode: 'test' }), [play]);
  return (
    <div className="complete arena">
      <Card title="Your starting point">
        {timeUp && <p role="status">Time is up, so we marked what you answered.</p>}
        <p>
          You got {result.correct} of {result.total} right.
        </p>
        <NewRewards rewards={earned} />
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
  onFinished: (outcome: Outcome) => void;
}) {
  const api = useLearnApi();
  const { play } = useSound();
  useHideBugButton(true); // Test mode questions: no bug button until the results.
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ ref: ErrorDetails | undefined } | null>(null);
  const earned = useRef<RewardCardResponse[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(test.timeLimitSeconds);
  const startedAt = useRef(Date.now());
  const shownAt = useRef(Date.now());
  const finishing = useRef(false);
  const warned = useRef(false);
  /** Said once by screen readers (F14): the visible clock stays quiet, so it never reads every second. */
  const [announcement, setAnnouncement] = useState('');

  const finish = useCallback(
    async (timeUp: boolean) => {
      if (finishing.current) return;
      finishing.current = true;
      try {
        const result = await api.finishStartingTest(test.id);
        onFinished({ result, timeUp, earned: earned.current });
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
        setAnnouncement('One minute left.');
      }
      if (left === 0) {
        setAnnouncement('Time is up.');
        void finish(true);
      }
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
        const marked = await api.submitAttempt({
          itemId: item.id,
          answer,
          timeMs: Math.max(0, Date.now() - shownAt.current),
          mode: 'test',
          startingTestId: test.id,
        });
        // Test mode stays quiet: rewards are announced on the results screen.
        // Unmarked (F12) earns nothing; the test moves on as usual.
        if (!('unmarked' in marked)) earned.current = [...earned.current, ...marked.newlyEarned];
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
    <div className="lesson arena">
      <div className="lesson__top">
        <ArenaProgress label="Test progress" value={index} max={test.items.length} />
        <span className={`timer${secondsLeft <= 60 ? ' timer--warning' : ''}`} aria-live="off">
          {clockText(secondsLeft)}
        </span>
        <span className="visually-hidden" aria-live="polite" data-testid="timer-announcer">
          {announcement}
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
 * Its answers set the first mastery for each topic. Arena look, but no right or wrong effects
 * until the reveal (docs/GAME_FEEL.md).
 */
export function StartingTestPage() {
  const { subjectId = '' } = useParams();
  const api = useLearnApi();
  const [test, setTest] = useState<StartingTestResponse | null>(null);
  const [problem, setProblem] = useState<{ text: string; ref?: ErrorDetails } | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const onFinished = useCallback((finished: Outcome) => setOutcome(finished), []);

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
    <div className="lesson arena">
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
