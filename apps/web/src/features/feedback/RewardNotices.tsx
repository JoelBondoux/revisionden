import { useCallback, useEffect, useState } from 'react';
import { Toast } from '../../components/Toast';
import { useFeedbackApi, type FeedbackReward } from './feedbackApi';

/**
 * Bug Hunter (docs/REWARDS.md): when the app opens on a student's device, tells the student
 * about each bug report the operator confirmed since they last looked, one toast at a time, then
 * marks them seen. Fails quietly: a missed notice comes back next time.
 */
export function RewardNotices() {
  const api = useFeedbackApi();
  const [queue, setQueue] = useState<FeedbackReward[]>([]);

  useEffect(() => {
    let live = true;
    api.listRewards().then(
      (rewards) => {
        if (!live || rewards.length === 0) return;
        setQueue(rewards);
        api.markRewardsSeen(rewards.map((r) => r.id)).catch(() => undefined);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [api]);

  const next = useCallback(() => setQueue((q) => q.slice(1)), []);
  const current = queue[0];
  if (!current) return null;
  return <Toast key={current.id} message={current.message} tone="success" onDismiss={next} />;
}
