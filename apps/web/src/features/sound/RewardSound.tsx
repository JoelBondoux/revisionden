import { useEffect, useRef } from 'react';
import type { EarnedReward } from './rewardSounds';
import { useSound } from './SoundProvider';

/**
 * Plays one sound, once, for rewards just earned: the biggest of them. Put it next to the visual
 * that announces the rewards (sound is never the only signal).
 */
export function RewardSound({ rewards }: { rewards: readonly EarnedReward[] }) {
  const { playReward } = useSound();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || rewards.length === 0) return;
    done.current = true;
    playReward(rewards);
  }, [playReward, rewards]);
  return null;
}
