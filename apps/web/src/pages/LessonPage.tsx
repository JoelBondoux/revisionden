import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../api/ApiContext';
import { LoadingOrError } from '../api/LoadingOrError';
import type { AnswerResult, Lesson, LessonItem } from '../api/schemas';
import { useApiResource } from '../api/useApiResource';
import { Button } from '../components/Button';
import { CloseIcon } from '../components/icons';
import { ProgressBar } from '../components/ProgressBar';
import { useSound } from '../features/sound';
import type { LessonResults } from './LessonCompletePage';

function AnswerInput({
  item,
  value,
  disabled,
  onChange,
}: {
  item: LessonItem;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  if (item.type === 'short-answer') {
    return (
      <div className="question">
        <p className="question__prompt" id={`prompt-${item.id}`}>
          {item.prompt}
        </p>
        <label className="field">
          <span className="field__label">Your answer</span>
          <input
            className="field__input"
            value={value}
            disabled={disabled}
            autoComplete="off"
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      </div>
    );
  }
  return (
    <fieldset className="question">
      <legend className="question__prompt">{item.prompt}</legend>
      <div className="options">
        {item.options.map((option) => (
          <label key={option.id} className="option">
            <input
              type="radio"
              name={item.id}
              value={option.id}
              checked={value === option.id}
              disabled={disabled}
              onChange={() => onChange(option.id)}
            />
            <span>{option.text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Feedback({ result }: { result: AnswerResult }) {
  return (
    <div
      className={`feedback feedback--${result.correct ? 'correct' : 'wrong'}`}
      role="status"
      aria-label="Answer feedback"
    >
      <p className="feedback__title">{result.correct ? 'Correct!' : 'Not quite'}</p>
      {result.correct ? <p>+{result.xpEarned} XP</p> : <p>Answer: {result.correctAnswer}</p>}
      <p>{result.explanation}</p>
    </div>
  );
}

function LessonRunner({ lesson }: { lesson: Lesson }) {
  const api = useApi();
  const navigate = useNavigate();
  const { play } = useSound();
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(false);
  const [totals, setTotals] = useState({ correct: 0, xpEarned: 0 });

  const item = lesson.items[index]!;
  const isLast = index === lesson.items.length - 1;

  async function check(event: FormEvent) {
    event.preventDefault();
    setChecking(true);
    setError(false);
    try {
      const marked = await api.submitAnswer(lesson.id, { itemId: item.id, answer });
      play(marked.correct ? 'correct' : 'wrong');
      setResult(marked);
      setTotals((t) => ({
        correct: t.correct + (marked.correct ? 1 : 0),
        xpEarned: t.xpEarned + marked.xpEarned,
      }));
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  }

  function advance() {
    if (isLast) {
      const results: LessonResults = { ...totals, total: lesson.items.length };
      navigate(`/lesson/${lesson.id}/complete`, { state: results, replace: true });
      return;
    }
    setIndex(index + 1);
    setAnswer('');
    setResult(null);
  }

  return (
    <form className="lesson" onSubmit={check}>
      <div className="lesson__top">
        <Link to="/map" className="icon-button" aria-label="Leave lesson">
          <CloseIcon />
        </Link>
        <ProgressBar
          label="Lesson progress"
          tone="success"
          value={index + (result ? 1 : 0)}
          max={lesson.items.length}
        />
      </div>
      <h1>{lesson.title}</h1>
      <AnswerInput
        key={item.id}
        item={item}
        value={answer}
        disabled={result !== null}
        onChange={setAnswer}
      />
      <div className="lesson__footer">
        {error && (
          <p role="alert" className="feedback feedback--wrong">
            Couldn&apos;t check that answer. Please try again.
          </p>
        )}
        {result && <Feedback result={result} />}
        {result ? (
          <Button block variant={result.correct ? 'success' : 'primary'} onClick={advance}>
            {isLast ? 'Finish' : 'Continue'}
          </Button>
        ) : (
          <Button block type="submit" disabled={answer.trim() === '' || checking}>
            Check
          </Button>
        )}
      </div>
    </form>
  );
}

export function LessonPage() {
  const { lessonId = '' } = useParams();
  const api = useApi();
  const lesson = useApiResource(() => api.getLesson(lessonId), [api, lessonId]);
  if (lesson.status !== 'ready') return <LoadingOrError resource={lesson} />;
  return <LessonRunner key={lesson.data.id} lesson={lesson.data} />;
}
