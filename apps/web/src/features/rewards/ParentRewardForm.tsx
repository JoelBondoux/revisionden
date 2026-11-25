import { useState, type FormEvent } from 'react';
import {
  MAX_LEVEL,
  REWARDS,
  type CreateParentRewardRequest,
  type ParentReward,
  type ParentRewardTarget,
} from '@revisionden/core';
import { Button } from '../../components';
import './rewards.css';

/** Targets a parent can pick: milestones and chapter finales (named), or a level number. */
export const TARGET_REWARDS = REWARDS.filter(
  (r) => r.source === 'milestone' || r.id.endsWith('-finale'),
);

/** The form's choice for a saved target; `keep` is a target the form cannot show (kept as is). */
function choiceFor(target: ParentRewardTarget | undefined): string {
  if (!target) return TARGET_REWARDS[0]!.id;
  if (target.kind === 'date') return 'date';
  if (target.kind === 'stat') return target.stat === 'level' ? 'level' : 'keep';
  return TARGET_REWARDS.some((r) => r.id === target.rewardId) ? target.rewardId : 'keep';
}

interface FormProps {
  /** The reward being edited; leave out to add a new one. */
  initial?: ParentReward;
  submitLabel: string;
  onSubmit: (body: CreateParentRewardRequest) => Promise<void>;
  onCancel?: () => void;
  /** Clears the fields after a successful add (the rewards page keeps its form open). */
  resetOnSubmit?: boolean;
}

/**
 * The parent reward editor (workstream R5), shared by the rewards page and the parent stats
 * dashboard (K10): a short title, an optional note and one target (a level, a date or a named
 * reward). The API checks the same rules again.
 */
export function ParentRewardForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  resetOnSubmit,
}: FormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [target, setTarget] = useState(choiceFor(initial?.target));
  const [level, setLevel] = useState(
    initial?.target.kind === 'stat' && initial.target.stat === 'level'
      ? String(initial.target.atLeast)
      : '10',
  );
  const [note, setNote] = useState(initial?.note ?? '');
  const [date, setDate] = useState(initial?.target.kind === 'date' ? initial.target.on : '');
  const [problem, setProblem] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setProblem('Give the reward a short title');
      return;
    }
    if (target === 'date' && !date) {
      setProblem('Pick a date');
      return;
    }
    setProblem(null);
    const chosen: ParentRewardTarget =
      target === 'keep' && initial
        ? initial.target
        : target === 'level'
          ? {
              kind: 'stat',
              stat: 'level',
              atLeast: Math.min(MAX_LEVEL, Math.max(1, Number(level) || 1)),
            }
          : target === 'date'
            ? { kind: 'date', on: date }
            : { kind: 'reward', rewardId: target };
    try {
      await onSubmit({
        title: title.trim(),
        ...(note.trim() && { note: note.trim() }),
        target: chosen,
      });
    } catch {
      setProblem('Could not save. Please try again.');
      return;
    }
    if (resetOnSubmit) {
      setTitle('');
      setNote('');
    }
  }

  return (
    <form aria-label="Reward details" className="stack rewards-form" onSubmit={submit} noValidate>
      <label>
        Reward
        <input
          value={title}
          maxLength={60}
          placeholder="For example: cinema trip"
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        Note (optional)
        <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
      </label>
      <label>
        When they reach
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          {target === 'keep' && initial && <option value="keep">{initial.targetLabel}</option>}
          <option value="level">A level</option>
          <option value="date">A date</option>
          {TARGET_REWARDS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      {target === 'level' && (
        <label>
          Level
          <input
            type="number"
            min={1}
            max={MAX_LEVEL}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
        </label>
      )}
      {target === 'date' && (
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      )}
      {problem && (
        <p role="alert" className="rewards-form__error">
          {problem}
        </p>
      )}
      <p className="secondary-text">
        Keep it short and leave out names. Only you mark it as given; after that it is kept as
        history.
      </p>
      <div className="rewards__row">
        <Button type="submit">{submitLabel}</Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
