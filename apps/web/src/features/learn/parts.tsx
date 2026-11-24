import { useId, useState } from 'react';
import type { LearnItem, Progress } from '@revisionden/core';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { ProgressBar } from '../../components/ProgressBar';
import './learn.css';

/** Shown whenever unverified (draft) content is on screen. Only possible in development. */
export function DraftBanner() {
  return (
    <p role="note" className="draft-banner">
      <strong>DRAFT CONTENT</strong> Not yet checked. For development only.
    </p>
  );
}

export function DailyGoal({ progress }: { progress: Progress }) {
  return (
    <div className="daily-goal">
      <ProgressBar
        label="Daily goal"
        tone="gold"
        value={progress.xpToday}
        max={progress.dailyGoalXp}
        valueText={`${progress.xpToday} of ${progress.dailyGoalXp} XP`}
      />
      <Pill tone="streak">{progress.streak.current} day streak</Pill>
    </div>
  );
}

/** What the student has entered so far, before it becomes an answer. */
export type Draft = string | number | null;

export type Answer = number | string | { lines: string[] } | boolean;

/** Turns a draft into the answer the API expects, or null if nothing has been entered. */
export function toAnswer(item: LearnItem, draft: Draft): Answer | null {
  if (item.type === 'multiple_choice') return typeof draft === 'number' ? draft : null;
  const text = typeof draft === 'string' ? draft : '';
  if (item.type === 'working') {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.length > 0 ? { lines } : null;
  }
  return text.trim() === '' ? null : text;
}

interface ItemInputProps {
  item: LearnItem;
  draft: Draft;
  disabled: boolean;
  onChange: (draft: Draft) => void;
  /** Flashcards in a lesson: the student says whether they knew it. */
  onSelfCheck?: (knewIt: boolean) => void;
}

function FlashcardCheck({
  item,
  disabled,
  onSelfCheck,
}: {
  item: Extract<LearnItem, { type: 'flashcard' }>;
  disabled: boolean;
  onSelfCheck?: (knewIt: boolean) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="question">
      <p className="question__prompt">{item.front}</p>
      {revealed ? (
        <>
          <p className="question__reveal">{item.back}</p>
          {!disabled && (
            <div className="self-check">
              <Button variant="secondary" onClick={() => onSelfCheck?.(false)}>
                Not yet
              </Button>
              <Button variant="success" onClick={() => onSelfCheck?.(true)}>
                I knew it
              </Button>
            </div>
          )}
        </>
      ) : (
        <Button variant="secondary" onClick={() => setRevealed(true)}>
          Show answer
        </Button>
      )}
    </div>
  );
}

function TextAnswer({
  item,
  text,
  disabled,
  onChange,
}: {
  item: Extract<LearnItem, { type: 'short_answer' | 'numeric' }>;
  text: string;
  disabled: boolean;
  onChange: (draft: Draft) => void;
}) {
  const id = useId();
  return (
    <div className="question">
      <p className="question__prompt">{item.prompt}</p>
      <div className="field">
        <label className="field__label" htmlFor={id}>
          Your answer
        </label>
        <span className="field__row">
          <input
            id={id}
            className="field__input"
            value={text}
            disabled={disabled}
            autoComplete="off"
            inputMode={item.type === 'numeric' ? 'decimal' : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
          {item.type === 'numeric' && item.unit && <span className="field__unit">{item.unit}</span>}
        </span>
      </div>
      {item.hint && <p className="secondary-text">Hint: {item.hint}</p>}
    </div>
  );
}

/** The answer area for each item type. */
export function ItemInput({ item, draft, disabled, onChange, onSelfCheck }: ItemInputProps) {
  const text = typeof draft === 'string' ? draft : '';
  switch (item.type) {
    case 'multiple_choice':
      return (
        <fieldset className="question">
          <legend className="question__prompt">{item.prompt}</legend>
          <div className="options">
            {item.options.map((option, index) => (
              <label key={option} className="option">
                <input
                  type="radio"
                  name={item.id}
                  checked={draft === index}
                  disabled={disabled}
                  onChange={() => onChange(index)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    case 'flashcard':
      return <FlashcardCheck item={item} disabled={disabled} onSelfCheck={onSelfCheck} />;
    case 'working':
    case 'long_answer':
      return (
        <div className="question">
          <p className="question__prompt">{item.prompt}</p>
          <label className="field">
            <span className="field__label">
              {item.type === 'working' ? 'Your working (one step per line)' : 'Your answer'}
            </span>
            <textarea
              className="field__input field__input--multiline"
              value={text}
              disabled={disabled}
              rows={item.type === 'working' ? 5 : 8}
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
          {item.type === 'long_answer' && (
            <p className="secondary-text">
              Long answers will be marked by AI soon. For now, write your answer and compare it with
              your notes.
            </p>
          )}
        </div>
      );
    default:
      return <TextAnswer item={item} text={text} disabled={disabled} onChange={onChange} />;
  }
}
