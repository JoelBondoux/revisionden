import type { RewardCardResponse } from '@revisionden/core';
import { CrownIcon } from '../../components/icons';
import { LinkButton } from '../../components/links';
import { RewardSound } from '../sound';

/**
 * Announces rewards just earned by an answer or a flashcard session, with the reward sound
 * (sound is never the only signal). Shows nothing when there are none.
 */
export function NewRewards({ rewards }: { rewards: readonly RewardCardResponse[] }) {
  if (rewards.length === 0) return null;
  return (
    <div role="status" aria-label="New rewards" className="new-rewards">
      <RewardSound rewards={rewards} />
      {rewards.map((r) => (
        <p key={r.id}>New reward: {r.name}</p>
      ))}
      <LinkButton to="/rewards" variant="secondary" icon={<CrownIcon />}>
        See your rewards
      </LinkButton>
    </div>
  );
}
