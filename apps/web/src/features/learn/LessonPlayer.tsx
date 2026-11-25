import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LearnAttemptResponse, LearnItem, Progress } from '@revisionden/core';
import { Button, ButtonLink } from '../../components/Button';
import { Card } from '../../components/Card';
import { CloseIcon } from '../../components/icons';
import {
  ArenaProgress,
  ComboBadge,
  FloatUp,
  ParticleBurst,
  PipSays,
  RollingNumber,
  Shake,
  nextCombo,
  pipLine,
} from '../juice';
import { markSound, useSound } from '../sound';
import { useLearnApi } from './learnApi';
import {
  DailyGoal,
  DraftBanner,
  ItemInput,
  toAnswer,
  type Answer,
  type Draft,
  type OptionMark,
} from './parts';
import { SetComplete } from './SetComplete';

function Feedback({ result }: { result: LearnAttemptResponse }) {
  const feedback = result.feedback;
  const wrongLine = feedback?.firstWrongLine;
  return (
    <div
      className={`feedback feedback--${result.correct ? 'correct' : 'wrong'}`}
      role="status"
      aria-label="Answer feedback"
    >
      <p className="feedback__title">{result.correct ? 'Correct!' : 'Not quite'}</p>
      {result.correct ? (
        <p>
          +{result.xpEarned} XP
          {result.comboBonusXp ? ` (Includes +${result.comboBonusXp} XP combo bonus)` : ''}
        </p>
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
  /** Called after the last item instead of showing the set complete screen (recall checks). */
  onFinish?: () => void;
  /** Extra controls under the intro, such as a Skip button. */
  aside?: ReactNode;
}

/** The option a marked multiple choice answer should show as right, if we can tell. */
function rightOption(item: LearnItem, result: LearnAttemptResponse, chosen: Draft): number | null {
  if (item.type !== 'multiple_choice') return null;
  if (result.correct) return typeof chosen === 'number' ? chosen : null;
  const index = result.feedback ? item.options.indexOf(result.feedback.correctAnswer) : -1;
  return index >= 0 ? index : null;
}

/** The celebration on a right answer: particles burst and the XP floats up. */
function RightAnswerEffects({ xp }: { xp: number }) {
  return (
    <>
      <ParticleBurst />
      {xp > 0 && <FloatUp>+{xp} XP</FloatUp>}
    </>
  );
}

/**
 * Runs a lesson in Learn mode on the dark arena (docs/GAME_FEEL.md): every answer is marked
 * straight away (feedback level 1) with a burst, shake, combo and Pip's line.
 */
export function LessonPlayer({
  title,
  items,
  draftContent,
  intro,
  doneHref = '/learn',
  onFinish,
  aside,
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
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
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
      // The API counts combos (J4); older responses without it fall back to counting here.
      const streak = marked.combo ?? nextCombo(combo, marked.correct);
      setCombo(streak);
      setBestCombo((best) => Math.max(best, streak));
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
      if (onFinish) {
        onFinish();
        return;
      }
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
      <div className="arena">
        <SetComplete
          correct={totals.correct}
          marked={totals.marked}
          xp={totals.xp}
          bestCombo={bestCombo}
          progress={progress}
        />
      </div>
    );
  }

  const unmarked = item.type === 'extended_answer';
  const right = result ? rightOption(item, result, draft) : null;
  const optionMark = (option: number): OptionMark => ({
    right: option === right,
    extra: result?.correct && option === right ? <RightAnswerEffects xp={result.xpEarned} /> : null,
  });
  return (
    <form className="lesson arena" onSubmit={check}>
      <div className="lesson__top">
        <Link to={doneHref} className="icon-button" aria-label="Leave lesson">
          <CloseIcon />
        </Link>
        <ArenaProgress
          label="Lesson progress"
          value={index + (result || unmarked ? 1 : 0)}
          max={items.length}
        />
        <span className="lesson__xp">
          <RollingNumber value={totals.xp} label="XP this lesson" suffix=" XP" />
        </span>
      </div>
      {draftContent && <DraftBanner />}
      <div className="lesson__pip">
        <PipSays
          line={pipLine({ index, total: items.length, combo })}
          mood={combo >= 2 ? 'cheer' : 'happy'}
        />
        <ComboBadge combo={combo} />
      </div>
      <h1>{title}</h1>
      {intro && <p className="secondary-text">{intro}</p>}
      {aside}
      {progress && <DailyGoal progress={progress} />}
      <Shake key={item.id} active={result?.correct === false}>
        <ItemInput
          key={item.id}
          item={item}
          draft={draft}
          disabled={result !== null || checking}
          onChange={setDraft}
          onSelfCheck={(knewIt) => void submit(knewIt)}
          optionMark={optionMark}
        />
      </Shake>
      <div className="lesson__footer">
        {result?.correct && item.type !== 'multiple_choice' && (
          <span className="lesson__burst">
            <RightAnswerEffects xp={result.xpEarned} />
          </span>
        )}
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
