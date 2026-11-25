import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  insertRetry,
  type LearnAttemptResponse,
  type LearnItem,
  type LessonEntry,
  type Progress,
} from '@revisionden/core';
import { Button, ButtonLink } from '../../components/Button';
import { Card } from '../../components/Card';
import { CloseIcon } from '../../components/icons';
import { ReadAloudButton, itemSpeechText } from '../read-aloud';
import {
  ArenaProgress,
  ComboBadge,
  FloatUp,
  ParticleBurst,
  PipSays,
  RollingNumber,
  Shake,
  comboStep,
  nextCombo,
  pipLine,
} from '../juice';
import { markSound, useSound } from '../sound';
import { useLearnApi } from './learnApi';
import { NewRewards } from './NewRewards';
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

/** What read aloud says for the feedback box: the verdict, the answer and the explanation. */
function feedbackSpeech(result: LearnAttemptResponse): string {
  const feedback = result.feedback;
  const parts = [result.correct ? 'Correct!' : 'Not quite.'];
  if (!result.correct && feedback) parts.push(`Answer: ${feedback.correctAnswer}.`);
  if (feedback?.explanation) parts.push(feedback.explanation);
  return parts.join(' ');
}

function Feedback({ result, comingBack }: { result: LearnAttemptResponse; comingBack: boolean }) {
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
      {comingBack && <p>No worries: we&apos;ll try one like this again in a moment.</p>}
      {result.shaky && (
        <p>
          Nice one. That took a little while, so it&apos;ll come back another day to make it stick.
        </p>
      )}
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
  /** Recall check answers (Q4): sent as recall, so a wrong one never resets the combo. */
  recall?: boolean;
}

/** Why a question is showing, for questions that came back (learning from mistakes, F5). */
function comeBackNote(entry: LessonEntry<LearnItem>): string | null {
  if (entry.retry === 'similar') return "Here's one like the one you missed.";
  if (entry.retry === 'again') return "Let's try that one again.";
  if (entry.item.warmUp) return 'Warm-up: this one came up last time.';
  return null;
}

/** Questions that can come back after a wrong answer (not self-rated cards or long answers). */
const canRetry = (item: LearnItem) => item.type !== 'flashcard' && item.type !== 'extended_answer';

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
  recall = false,
}: LessonPlayerProps) {
  const api = useLearnApi();
  const { play } = useSound();
  const [queue, setQueue] = useState<LessonEntry<LearnItem>[]>(() =>
    items.map((item) => ({ item })),
  );
  const [comingBack, setComingBack] = useState(false);
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

  const entry = queue[index]!;
  const item = entry.item;
  const isLast = index === queue.length - 1;
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
        ...(recall ? { recall: true } : {}),
        ...(entry.retry ? { retry: true } : {}),
      });
      // A wrong answer brings a similar question back 2 to 4 questions later, or the same one at
      // the end (at most 2 a lesson, never a retry of a retry). F5.
      if (!marked.correct && !recall && canRetry(item)) {
        const similar = marked.similar;
        const fresh = similar && !queue.some((e) => e.item.id === similar.id);
        const next = insertRetry(
          queue,
          index,
          fresh ? { item: similar, similar: true } : { item, similar: false },
          Math.random,
        );
        setQueue(next);
        setComingBack(next !== queue);
      }
      // The API counts combos (J4); older responses without it fall back to counting here.
      const streak = marked.combo ?? nextCombo(combo, marked.correct);
      // The chime rises a step per right answer in a row (the first one is the plain chime).
      play(markSound(marked), { step: comboStep(streak - 1) });
      if (marked.progress.goalMet && progress && !progress.goalMet)
        play('streakDay', { delay: 0.4 });
      setResult(marked);
      setProgress(marked.progress);
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
    setComingBack(false);
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
          max={queue.length}
        />
        <span className="lesson__xp">
          <RollingNumber value={totals.xp} label="XP this lesson" suffix=" XP" />
        </span>
      </div>
      {draftContent && <DraftBanner />}
      <div className="lesson__pip">
        <PipSays
          line={pipLine({ index, total: queue.length, combo })}
          mood={combo >= 2 ? 'cheer' : 'happy'}
        />
        <ComboBadge combo={combo} />
      </div>
      <h1>{title}</h1>
      {intro && <p className="secondary-text">{intro}</p>}
      {aside}
      {progress && <DailyGoal progress={progress} />}
      {comeBackNote(entry) && <p className="lesson__comeback">{comeBackNote(entry)}</p>}
      <ReadAloudButton text={itemSpeechText(item)} label="Read the question aloud" />
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
        {result && <Feedback result={result} comingBack={comingBack} />}
        {result && <NewRewards rewards={result.newlyEarned} />}
        {result || unmarked ? (
          <Button block variant={result?.correct ? 'success' : 'primary'} onClick={advance}>
            {isLast ? 'Finish' : 'Continue'}
          </Button>
        ) : (
          item.type !== 'flashcard' && (
            <>
              <Button block type="submit" disabled={answer === null || checking}>
                Check
              </Button>
              {entry.retry && (
                <Button block variant="secondary" onClick={advance} disabled={checking}>
                  Skip this one
                </Button>
              )}
            </>
          )
        )}
      </div>
    </form>
  );
}
