import { useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { hasPowers, showsPowers, type LearnItem, type Progress } from '@revisionden/core';
import { Button } from '../../components/Button';
import { MathText } from '../../components/MathText';
import { Pill } from '../../components/Pill';
import { ProgressBar } from '../../components/ProgressBar';
import { AreaModelStep } from '../interactive';
import './learn.css';

/** Shown whenever unverified (draft) content is on screen. Only possible in development. */
/**
 * Owner (UX-1): screens look as they will at launch, so draft content is marked by one slim line
 * at the very bottom of the screen (lessons, the starting test, Cards), never a banner at the top.
 * Put it last, after Check or Continue, so it never covers them.
 */
export function DraftNote() {
  return (
    <p role="note" className="draft-note">
      Draft content: not checked yet. For testing only.
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
  if (item.type === 'worked_maths') {
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
  /** After marking (Learn mode only): how each multiple choice option looks, and any effect in it. */
  optionMark?: (index: number) => OptionMark;
}

export interface OptionMark {
  right?: boolean;
  /** Shown inside the option, e.g. a particle burst. */
  extra?: ReactNode;
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
      <p className="question__prompt">
        <MathText text={item.front} subject={item.topicId} />
      </p>
      {revealed ? (
        <>
          <p className="question__reveal">
            <MathText text={item.back} subject={item.topicId} />
          </p>
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

/**
 * F9: a "Power" key that types ^ where the cursor is (phone keypads often have no ^), and a
 * preview of the answer with its powers raised. ² typed straight in still works. Not in
 * computing, where ^ is a real symbol and is shown as typed.
 */
function PowerTools({
  field,
  text,
  subject,
  disabled,
  onChange,
}: {
  field: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  text: string;
  subject: string;
  disabled: boolean;
  onChange: (draft: Draft) => void;
}) {
  if (!showsPowers(subject)) return null;
  function typePower() {
    const box = field.current;
    const at = box?.selectionStart ?? text.length;
    const end = box?.selectionEnd ?? at;
    onChange(`${text.slice(0, at)}^${text.slice(end)}`);
    box?.focus();
    requestAnimationFrame(() => box?.setSelectionRange(at + 1, at + 1));
  }
  return (
    <div className="power-tools">
      <Button variant="secondary" disabled={disabled} onClick={typePower}>
        Power{' '}
        <span aria-hidden="true">
          x<sup>n</sup>
        </span>
      </Button>
      {hasPowers(text) && (
        <p className="secondary-text answer-preview" data-testid="answer-preview">
          Shows as: <MathText text={text} subject={subject} />
        </p>
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
  const field = useRef<HTMLInputElement>(null);
  return (
    <div className="question">
      <p className="question__prompt">
        <MathText text={item.prompt} subject={item.topicId} />
      </p>
      <div className="field">
        <label className="field__label" htmlFor={id}>
          Your answer
        </label>
        <span className="field__row">
          <input
            ref={field}
            id={id}
            className="field__input"
            value={text}
            disabled={disabled}
            autoComplete="off"
            inputMode={item.type === 'numeric' ? 'decimal' : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
          {item.type === 'numeric' && item.unit && (
            <span className="field__unit">
              <MathText text={item.unit} subject={item.topicId} />
            </span>
          )}
        </span>
      </div>
      <PowerTools
        field={field}
        text={text}
        subject={item.topicId}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

/** The answer area for each item type. */
export function ItemInput({
  item,
  draft,
  disabled,
  onChange,
  onSelfCheck,
  optionMark,
}: ItemInputProps) {
  const text = typeof draft === 'string' ? draft : '';
  const working = useRef<HTMLTextAreaElement>(null);
  switch (item.type) {
    case 'multiple_choice':
      return (
        <fieldset className="question">
          <legend className="question__prompt">
            <MathText text={item.prompt} subject={item.topicId} />
          </legend>
          <div className="answer-grid">
            {item.options.map((option, index) => {
              const mark = optionMark?.(index);
              return (
                <label
                  key={option}
                  className={`answer-option${mark?.right ? ' answer-option--right' : ''}`}
                >
                  <input
                    type="radio"
                    name={item.id}
                    checked={draft === index}
                    disabled={disabled}
                    onChange={() => onChange(index)}
                  />
                  <span>
                    <MathText text={option} subject={item.topicId} />
                  </span>
                  {mark?.extra}
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    case 'flashcard':
      return <FlashcardCheck item={item} disabled={disabled} onSelfCheck={onSelfCheck} />;
    case 'worked_maths':
    case 'extended_answer':
      return (
        <div className="question">
          <p className="question__prompt">
            <MathText text={item.prompt} subject={item.topicId} />
          </p>
          <label className="field">
            <span className="field__label">
              {item.type === 'worked_maths' ? 'Your working (one step per line)' : 'Your answer'}
            </span>
            <textarea
              ref={working}
              className="field__input field__input--multiline"
              value={text}
              disabled={disabled}
              rows={item.type === 'worked_maths' ? 5 : 8}
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
          {item.type === 'worked_maths' && (
            <PowerTools
              field={working}
              text={text}
              subject={item.topicId}
              disabled={disabled}
              onChange={onChange}
            />
          )}
          {item.type === 'extended_answer' && (
            <p className="secondary-text">
              Long answers will be marked by AI soon. For now, write your answer and compare it with
              your notes.
            </p>
          )}
        </div>
      );
    case 'area_model':
      return <AreaModelStep item={item} draft={text} disabled={disabled} onChange={onChange} />;
    default:
      return <TextAnswer item={item} text={text} disabled={disabled} onChange={onChange} />;
  }
}
