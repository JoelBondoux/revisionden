import { useState } from 'react';
import type { RewardCardResponse } from '@revisionden/core';
import { CrownIcon } from '../../components/icons';
import { LinkButton } from '../../components/links';
import { PrizeBox } from '../juice/prize';

const keyOf = (rewards: readonly RewardCardResponse[]) =>
  rewards
    .map((r) => r.id)
    .sort()
    .join(' ');

/**
 * Announces rewards just earned by an answer or a flashcard session. They arrive in a prize box
 * (J17), which plays the reward sound; the plain announcement stays beside it after Collect
 * (sound and motion are never the only signal). Shows nothing when there are none.
 */
export function NewRewards({ rewards }: { rewards: readonly RewardCardResponse[] }) {
  const key = keyOf(rewards);
  const [collected, setCollected] = useState<string | null>(null);
  if (rewards.length === 0) return null;
  return (
    <>
      {collected !== key && (
        <PrizeBox key={key} rewards={rewards} onClose={() => setCollected(key)} />
      )}
      <div role="status" aria-label="New rewards" className="new-rewards">
        {rewards.map((r) => (
          <p key={r.id}>New reward: {r.name}</p>
        ))}
        <LinkButton to="/rewards" variant="secondary" icon={<CrownIcon />}>
          See your rewards
        </LinkButton>
      </div>
    </>
  );
}
