import { useEffect } from 'react';
import type { Progress } from '@revisionden/core';
import { ButtonLink } from '../../components/Button';
import { Card } from '../../components/Card';
import { Confetti, StarReveal, pastDailyCap, starsForSet } from '../juice';
import { useSound } from '../sound';
import { DailyGoal } from './parts';

interface SetCompleteProps {
  correct: number;
  marked: number;
  xp: number;
  bestCombo: number;
  progress: Progress | null;
  /** Where Next mission goes (the map, with its next mission card). */
  nextHref?: string;
}

/**
 * The end of a lesson (docs/GAME_FEEL.md "Set complete"): stars, confetti, XP tally, best combo,
 * the daily goal, then a pulsing Next mission. Past the daily cap it says see you tomorrow.
 */
export function SetComplete({
  correct,
  marked,
  xp,
  bestCombo,
  progress,
  nextHref = '/map',
}: SetCompleteProps) {
  const { play } = useSound();
  useEffect(() => void play('celebration'), [play]);
  const capped = progress !== null && pastDailyCap(progress.xpToday);
  return (
    <div className="complete set-complete">
      <Confetti />
      <Card title="Lesson complete">
        <StarReveal stars={starsForSet(correct, marked)} />
        <div className="complete__stats">
          <div className="stat stat--success">
            <span className="stat__label">Right answers</span>
            <span className="stat__value">
              {correct} of {marked}
            </span>
          </div>
          <div className="stat stat--gold">
            <span className="stat__label">XP earned</span>
            <span className="stat__value">+{xp} XP</span>
          </div>
          {bestCombo >= 2 && (
            <div className="stat stat--combo">
              <span className="stat__label">Best combo</span>
              <span className="stat__value">×{bestCombo}</span>
            </div>
          )}
        </div>
        {progress && <DailyGoal progress={progress} />}
        {capped ? (
          <ButtonLink to={nextHref} block variant="secondary">
            Great work today. See you tomorrow
          </ButtonLink>
        ) : (
          <>
            <ButtonLink to={nextHref} block className="cta-pulse">
              Next mission
            </ButtonLink>
            {progress?.goalMet && (
              <p className="secondary-text">Or take a break. Your streak is safe for today.</p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
