import {
  COLLECTIONS,
  REWARDS,
  SEASONS,
  parentTargetLabel,
  type RewardCardResponse,
} from '@revisionden/core';
import { ParticleBurst } from '../juice';
import { RarityPill, itemWords } from './parts';
import './reveal.css';

/**
 * Why a reward was earned, in words, from its one stated target in the catalogue. Null when the
 * reward is not in the catalogue: we never make a reason up.
 */
export function rewardReason(id: string): string | null {
  const reward = REWARDS.find((r) => r.id === id);
  if (!reward) return null;
  const { target } = reward;
  if (target.kind === 'stat') return parentTargetLabel(target);
  if (target.kind === 'collection') {
    const collection = COLLECTIONS.find((c) => c.id === target.collectionId);
    return collection ? `Completed the ${collection.name} collection` : null;
  }
  const season = SEASONS.find((s) => s.id === target.seasonId);
  if (!season) return null;
  const measure = season.measure === 'correctAnswers' ? 'right answers' : 'daily goal days';
  return `${target.atLeast} ${measure} in ${season.name}`;
}

const BURSTS: ReadonlySet<RewardCardResponse['rarity']> = new Set(['epic', 'legendary']);

/**
 * Newly earned rewards, revealed with a visual tier that matches U's tiered reward sound (common
 * to legendary). Each shows exactly what was earned and why: no mystery boxes, no random draws.
 */
export function RewardReveal({ rewards }: { rewards: readonly RewardCardResponse[] }) {
  if (rewards.length === 0) return null;
  return (
    <ul className="reward-reveals">
      {rewards.map((reward, i) => {
        const reason = rewardReason(reward.id);
        return (
          <li
            key={reward.id}
            className={`reward-reveal reward-reveal--${reward.rarity}`}
            style={{ animationDelay: `${i * 150}ms` }}
          >
            {BURSTS.has(reward.rarity) && (
              <ParticleBurst count={reward.rarity === 'legendary' ? 24 : 16} />
            )}
            <p className="reward-reveal__name">New: {reward.name}</p>
            <span className="reward-reveal__meta">
              <RarityPill rarity={reward.rarity} />
              <span>{itemWords(reward)}</span>
            </span>
            {reason && <p className="reward-reveal__why">For: {reason}</p>}
          </li>
        );
      })}
    </ul>
  );
}
