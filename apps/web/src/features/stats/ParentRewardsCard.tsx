import { useMemo, useState } from 'react';
import type { ParentReward } from '@revisionden/core';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Pill } from '../../components';
import { ProgressBar } from '../../components/ProgressBar';
import { GrowIn } from './countUp';
import { defaultBaseUrl } from '../../api/ApiContext';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { ParentRewardForm } from '../rewards/ParentRewardForm';
import { createRewardsApi, type RewardsApi } from '../rewards/rewardsApi';
import { useStatsApi } from './statsApi';

type Editing = { kind: 'add' } | { kind: 'edit'; reward: ParentReward } | null;

/**
 * Parent-set rewards on the parent stats dashboard (workstream K10): every reward with its
 * progress, and add, edit and remove right here, using R's editor and routes
 * (apps/web/src/features/rewards, apps/api/src/routes/rewards.ts), so the checks and the
 * two-parent activity log are the same as on the rewards page.
 */
export function ParentRewardsCard({ studentId, api }: { studentId: string; api?: RewardsApi }) {
  const rewardsApi = useMemo(
    () =>
      api ?? createRewardsApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
    [api],
  );
  const [version, setVersion] = useState(0);
  const statsApi = useStatsApi();
  // Read-only, so a parent looking never uses up the child's "New!" rewards.
  const resource = useApiResource(
    () => statsApi.getParentRewards(studentId),
    [statsApi, studentId, version],
  );
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const reload = () => setVersion((v) => v + 1);

  const remove = async (reward: ParentReward) => {
    try {
      await rewardsApi.removeParentReward(studentId, reward.id);
      setRemoving(null);
      setProblem(null);
      reload();
    } catch {
      setProblem('Could not remove it. Please try again.');
    }
  };

  const list = (rewards: ParentReward[]) =>
    rewards.length === 0 ? (
      <p className="secondary-text">No rewards yet. Add one to give them something to aim for.</p>
    ) : (
      <ul className="stats-list">
        {rewards.map((r) => (
          <li key={r.id}>
            <span className="stats-list__row">
              <strong>{r.title}</strong>
              {r.givenAt ? (
                <Pill tone="success">Given</Pill>
              ) : (
                r.reached && <Pill tone="gold">Reached</Pill>
              )}
            </span>
            <GrowIn>
              <ProgressBar
                label={r.title}
                value={Math.min(r.current, r.goal)}
                max={r.goal}
                valueText={`${r.current} of ${r.goal} (${r.targetLabel})`}
                tone="gold"
              />
            </GrowIn>
            <span className="secondary-text">{`${r.targetLabel}: ${r.current} of ${r.goal}`}</span>
            {!r.givenAt &&
              (removing === r.id ? (
                <div role="group" aria-label={`Remove ${r.title}?`} className="limit-suggestion">
                  <p>{`Remove ${r.title}? Your child will no longer see it.`}</p>
                  <div className="limit-suggestion__actions">
                    <Button onClick={() => void remove(r)}>Yes, remove</Button>
                    <Button variant="secondary" onClick={() => setRemoving(null)}>
                      Keep it
                    </Button>
                  </div>
                </div>
              ) : (
                <span className="stats-list__row no-print">
                  <Button
                    variant="secondary"
                    aria-label={`Edit ${r.title}`}
                    onClick={() => setEditing({ kind: 'edit', reward: r })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    aria-label={`Remove ${r.title}`}
                    onClick={() => setRemoving(r.id)}
                  >
                    Remove
                  </Button>
                </span>
              ))}
          </li>
        ))}
      </ul>
    );

  return (
    <Card title="Rewards">
      {resource.status === 'ready' ? (
        list(resource.data.parentRewards)
      ) : (
        <LoadingOrError resource={resource} />
      )}
      {problem && (
        <p role="alert" className="secondary-text">
          {problem}
        </p>
      )}
      {editing ? (
        <ParentRewardForm
          key={editing.kind === 'edit' ? editing.reward.id : 'add'}
          initial={editing.kind === 'edit' ? editing.reward : undefined}
          submitLabel="Save reward"
          onCancel={() => setEditing(null)}
          onSubmit={async (body) => {
            if (editing.kind === 'edit') {
              await rewardsApi.updateParentReward(studentId, editing.reward.id, {
                ...body,
                note: body.note ?? null,
              });
            } else {
              await rewardsApi.addParentReward(studentId, body);
            }
            setEditing(null);
            reload();
          }}
        />
      ) : (
        <Button className="no-print" onClick={() => setEditing({ kind: 'add' })}>
          Add a reward
        </Button>
      )}
    </Card>
  );
}
