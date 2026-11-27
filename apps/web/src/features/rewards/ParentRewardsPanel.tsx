import { useState } from 'react';
import type { ParentReward } from '@revisionden/core';
import { Button, Card, Pill } from '../../components';
import { useApiResource } from '../../api/useApiResource';
import { ApiError } from '../../api/client';
import { LoadingOrError } from '../../api/LoadingOrError';
import { ParentRewardForm } from './ParentRewardForm';
import type { RewardsApi } from './rewardsApi';
import './rewards.css';

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
                  aria-label={`Mark as given: ${r.title}`}
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
      <ParentRewardForm
        submitLabel="Add reward"
        resetOnSubmit
        onSubmit={async (body) => {
          await api.addParentReward(studentId, body);
          reload();
        }}
      />
    </Card>
  );
}
