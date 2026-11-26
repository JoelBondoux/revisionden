import { useId } from 'react';
import type { NextMission } from '@revisionden/core';
import { ButtonLink } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { DailyRow } from '../features/daily';
import { InstallRow } from './InstallRow';

interface TodayStripProps {
  xpToday: number;
  dailyGoalXp: number;
  mission: NextMission | null;
}

/**
 * One "Today" card at the top of the map (J12b): the daily goal, the next mission with its Go
 * button (the main call to action), the 5-a-day while there is one, and the install row while the
 * device can install. It replaces the separate goal, 5-a-day, Next mission and install cards.
 */
export function TodayStrip({ xpToday, dailyGoalXp, mission }: TodayStripProps) {
  const headingId = useId();
  const missionId = useId();
  return (
    <section className="today-strip" aria-labelledby={headingId}>
      <div className="today-strip__head">
        <h2 id={headingId} className="today-strip__heading">
          Today
        </h2>
        <div className="today-strip__goal">
          <ProgressBar
            label="Daily goal"
            tone="gold"
            value={xpToday}
            max={dailyGoalXp}
            valueText={`${xpToday} of ${dailyGoalXp} XP`}
          />
          <span className="today-strip__xp">
            {xpToday} / {dailyGoalXp} XP
          </span>
        </div>
      </div>
      <ul className="today-strip__list">
        {mission && (
          <li>
            <section className="today-strip__row today-strip__mission" aria-labelledby={missionId}>
              <div className="today-strip__what">
                <span className="today-strip__eyebrow-row">
                  <h3 id={missionId} className="today-strip__eyebrow">
                    Next mission
                  </h3>
                  <span className="today-strip__meta">{mission.minutes} min</span>
                </span>
                <span className="today-strip__title">{mission.title}</span>
              </div>
              <ButtonLink
                to={`/learn/topic/${mission.lessonId}`}
                variant="gold"
                aria-label={`Go: ${mission.title}`}
              >
                Go
              </ButtonLink>
            </section>
          </li>
        )}
        <DailyRow />
        <InstallRow />
      </ul>
    </section>
  );
}
