import { useId } from 'react';
import type { NextMission } from '@revisionden/core';
import { ButtonLink } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { DailyRow } from '../features/daily';
import { InstallRow } from './InstallRow';

/** A small filled star for a smashed goal (decorative). */
function StarIcon() {
  return (
    <svg
      className="today-strip__star"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21l1.5-7L2 9.3l7-.8z"
        fill="var(--color-gold)"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  // Past the goal, celebrate rather than show "195 / 50" (J12d).
  const smashed = dailyGoalXp > 0 && xpToday >= dailyGoalXp;
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
            value={Math.min(xpToday, dailyGoalXp)}
            max={dailyGoalXp}
            valueText={
              smashed
                ? `Goal smashed: ${xpToday} XP, goal ${dailyGoalXp} XP`
                : `${xpToday} of ${dailyGoalXp} XP`
            }
          />
          {smashed ? (
            <span className="today-strip__xp today-strip__xp--smashed">
              <StarIcon />
              <span className="today-strip__smashed">Goal smashed!</span> {xpToday} XP
            </span>
          ) : (
            <span className="today-strip__xp">
              {xpToday} / {dailyGoalXp} XP
            </span>
          )}
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
