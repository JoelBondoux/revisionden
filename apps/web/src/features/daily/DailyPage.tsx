import { Navigate } from 'react-router-dom';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { LessonPlayer } from '../learn/LessonPlayer';
import { useDailyApi } from './dailyApi';

/**
 * Today's 5-a-day at `/learn/daily`, in the normal lesson player (Learn mode, normal XP and
 * combos), so the game feel and the daily goal apply as in any lesson. Answered ones are skipped.
 */
export function DailyPage() {
  const api = useDailyApi();
  const daily = useApiResource(() => api.getDaily(), [api]);
  if (daily.status !== 'ready') return <LoadingOrError resource={daily} />;
  const answered = new Set(daily.data.answeredItemIds);
  const items = daily.data.items.filter((i) => !answered.has(i.id));
  if (items.length === 0) return <Navigate to="/map" replace />;
  return (
    <LessonPlayer
      title="5-a-day"
      intro="A quick mix from topics you've already practised."
      items={items}
      draftContent={daily.data.draftContent}
      doneHref="/map"
    />
  );
}
