import { useState, type FormEvent } from 'react';
import { MAX_LEVEL, REWARDS, type ParentReward } from '@revisionden/core';
import { Button, Card, Pill } from '../../components';
import { useApiResource } from '../../api/useApiResource';
import { ApiError } from '../../api/client';
import { LoadingOrError } from '../../api/LoadingOrError';
import type { RewardsApi } from './rewardsApi';
import './rewards.css';

/** Targets a parent can pick: milestones and chapter finales (named), or a level number. */
const TARGET_REWARDS = REWARDS.filter((r) => r.source === 'milestone' || r.id.endsWith('-finale'));

interface PanelProps {
  api: RewardsApi;
  studentId: string;
  nickname: string;
}

/** Parent view: add real-world rewards to any target and mark them as given. */
export function ParentRewardsPanel({ api, studentId, nickname }: PanelProps) {
  const [version, setVersion] = useState(0);
  const resource = useApiResource(
    () =>
      api.getChildRewards(studentId).catch((err: unknown) => {
        throw err instanceof ApiError ? err : new ApiError('network', String(err));
      }),
    [api, studentId, version],
  );
  const reload = () => setVersion((v) => v + 1);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState(TARGET_REWARDS[0]!.id);
  const [level, setLevel] = useState('10');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  async function add(event: FormEvent) {
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
    await api.addParentReward(studentId, {
      title: title.trim(),
      ...(note.trim() && { note: note.trim() }),
      target:
        target === 'level'
          ? {
              kind: 'stat',
              stat: 'level',
              atLeast: Math.min(MAX_LEVEL, Math.max(1, Number(level) || 1)),
            }
          : target === 'date'
            ? { kind: 'date', on: date }
            : { kind: 'reward', rewardId: target },
    });
    setTitle('');
    setNote('');
    reload();
  }

  const act = (run: () => Promise<unknown>) => async () => {
    await run();
    reload();
  };

  const list = (rewards: ParentReward[]) =>
    rewards.length === 0 ? (
      <p className="secondary-text">No real-world rewards yet.</p>
    ) : (
      <ul className="rewards__list">
        {rewards.map((r) => (
          <li key={r.id} aria-label={r.title}>
            <span className="rewards__row">
              <strong>{r.title}</strong>
              {r.givenAt ? (
                <Pill tone="success">Given</Pill>
              ) : (
                r.reached && <Pill tone="gold">Reached</Pill>
              )}
            </span>
            {r.note && <span>{r.note}</span>}
            <span className="secondary-text">{r.targetLabel}</span>
            <span className="secondary-text">
              {r.current} of {r.goal}
            </span>
            <span className="rewards__row">
              {!r.givenAt && (
                <Button
                  variant="secondary"
                  aria-label={`Mark ${r.title} as given`}
                  onClick={act(() => api.markGiven(studentId, r.id))}
                >
                  Mark as given
                </Button>
              )}
              {!r.givenAt && (
                <Button
                  variant="secondary"
                  aria-label={`Remove ${r.title}`}
                  onClick={act(() => api.removeParentReward(studentId, r.id))}
                >
                  Remove
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
    );

  return (
    <Card title={`Real-world rewards for ${nickname}`}>
      {resource.status === 'ready' ? (
        list(resource.data.parentRewards)
      ) : (
        <LoadingOrError resource={resource} />
      )}
      <form className="stack rewards-form" onSubmit={add} noValidate>
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
        <Button type="submit">Add reward</Button>
      </form>
    </Card>
  );
}
