import { useId } from 'react';
import { useApiResource } from '../../api/useApiResource';
import { ButtonLink } from '../../components/Button';
import { useDailyApi } from './dailyApi';

/**
 * The 5-a-day as one row of the map's Today strip (J12b). Shows only while today's set has
 * questions left; never shows an error (the map works without it) and never nags.
 */
export function DailyRow() {
  const api = useDailyApi();
  const headingId = useId();
  const daily = useApiResource(() => api.getDaily(), [api]);
  if (daily.status !== 'ready') return null;
  const { total, answered, done } = daily.data;
  if (total === 0 || done) return null;
  const started = answered > 0;
  return (
    <li>
      <section className="today-strip__row today-strip__daily" aria-labelledby={headingId}>
        <div className="today-strip__what today-strip__what--inline">
          <h3 id={headingId} className="today-strip__eyebrow">
            5-a-day
          </h3>
          <span className="today-strip__title">
            {answered} of {total} done
          </span>
        </div>
        <ButtonLink
          to="/learn/daily"
          variant="secondary"
          aria-label={`${started ? 'Continue' : 'Start'} your 5-a-day`}
        >
          {started ? 'Continue' : 'Start'}
        </ButtonLink>
      </section>
    </li>
  );
}
