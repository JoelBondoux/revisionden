import { useId } from 'react';
import { useApiResource } from '../../api/useApiResource';
import { ButtonLink } from '../../components/Button';
import { ProgressBar } from '../../components/ProgressBar';
import { useDailyApi } from './dailyApi';

/**
 * The 5-a-day card at the top of the topic map. Shows only while today's set has questions
 * left; never shows an error (the map works without it) and never nags.
 */
export function DailyCard() {
  const api = useDailyApi();
  const headingId = useId();
  const daily = useApiResource(() => api.getDaily(), [api]);
  if (daily.status !== 'ready') return null;
  const { total, answered, done } = daily.data;
  if (total === 0 || done) return null;
  const started = answered > 0;
  return (
    <section className="daily-card" aria-labelledby={headingId}>
      <div className="daily-card__text">
        <h2 id={headingId} className="daily-card__title">
          5-a-day
        </h2>
        <p className="secondary-text">
          A quick mix from topics you&apos;ve already practised. About 5–8 minutes.
        </p>
        <ProgressBar
          label="5-a-day progress"
          tone="success"
          value={answered}
          max={total}
          valueText={`${answered} of ${total} done`}
        />
        <p className="daily-card__count">
          {answered} of {total} done
        </p>
      </div>
      <ButtonLink to="/learn/daily" aria-label={`${started ? 'Continue' : 'Start'} your 5-a-day`}>
        {started ? 'Continue' : 'Start'}
      </ButtonLink>
    </section>
  );
}
