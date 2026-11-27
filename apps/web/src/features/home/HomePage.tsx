import { Link, Navigate } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import type { TopicMap } from '@revisionden/core';
import { useApi } from '../../api/ApiContext';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { CardsIcon, FlameIcon, StarIcon } from '../../components/icons';
import { InstallRow } from '../../map/InstallRow';
import { useStudent } from '../../session/StudentContext';
import { useDailyApi } from '../daily/dailyApi';
import { PipFigure, setPipSubject } from '../juice/pip';
import { lookFor, outfitFor } from '../juice/pip/outfits';
import { CountUp } from '../stats/countUp';
import { useStatsApi } from '../stats/statsApi';
import '../../map/map.css';
import { LeagueChip } from '../league';
import { loadSubjectMap, reportMap, useChosenSubject } from '../subjects';
import './home.css';

/**
 * Home (J15b, owner 2026-11-26): where Pip takes you. One screen of where you stand and today's
 * goals, low on words: level and XP, streak, the goal rings, one big next-mission button, weak
 * spots to fix, the friends league (soon) and this week's days towards the reward.
 */

const whole = (n: number) => String(Math.round(n));

/** A ring that fills to `value / max`, with the same name and value a progress bar has. */
function Ring({
  label,
  value,
  max,
  valueText,
  size,
  stroke,
  tone,
  children,
}: {
  label: string;
  value: number;
  max: number;
  valueText: string;
  size: number;
  stroke: number;
  tone: string;
  children: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const share = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div
      className="home-ring"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      aria-valuetext={valueText}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="home-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
        />
        <circle
          className="home-ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke={tone}
          strokeDasharray={length}
          style={
            { '--ring-empty': `${length}px`, '--ring-full': `${length * (1 - share)}px` } as never
          }
        />
      </svg>
      <span className="home-ring__inside">{children}</span>
    </div>
  );
}

const WEEKDAYS: Record<string, string> = {
  Mon: 'Mon',
  Tue: 'Tue',
  Wed: 'Wed',
  Thu: 'Thu',
  Fri: 'Fri',
  Sat: 'Sat',
  Sun: 'Sun',
};

function weakSpots(map: TopicMap) {
  return map.units
    .flatMap((u) => u.topics)
    .filter((t) => t.status === 'weak')
    .slice(0, 6);
}

export function HomePage() {
  const api = useApi();
  const stats = useStatsApi();
  const daily = useDailyApi();
  const { studentId } = useStudent();
  const never = () => new Promise<never>(() => {});
  const subjectId = useChosenSubject(studentId);
  const map = useApiResource(
    () => (studentId ? loadSubjectMap((id) => api.getTopicMap(id), studentId, subjectId) : never()),
    [api, studentId, subjectId],
  );
  useEffect(() => {
    if (map.status === 'ready') reportMap(studentId, map.data);
  }, [map, studentId]);
  const week = useApiResource(
    () => (studentId ? stats.getMyStats('week') : never()),
    [stats, studentId],
  );
  const five = useApiResource(() => (studentId ? daily.getDaily() : never()), [daily, studentId]);
  const cards = useApiResource(() => (studentId ? api.getCardsDue() : never()), [api, studentId]);

  if (!studentId) return <Navigate to="/family" replace />;

  return (
    <div className="home">
      <h1 className="visually-hidden">Home</h1>
      {map.status !== 'ready' ? (
        <LoadingOrError resource={map} />
      ) : (
        <HomeBody
          map={map.data}
          level={week.status === 'ready' ? week.data.level : null}
          days={week.status === 'ready' ? week.data.chart.buckets : null}
          fiveADay={five.status === 'ready' && five.data.total > 0 ? five.data : null}
          cardsDue={cards.status === 'ready' ? cards.data.due : null}
        />
      )}
    </div>
  );
}

function HomeBody({
  map,
  level,
  days,
  fiveADay,
  cardsDue,
}: {
  map: TopicMap;
  level: { level: number; xpIntoLevel: number; xpForNextLevel: number } | null;
  days: { start: string; label: string; value: number }[] | null;
  fiveADay: { answered: number; total: number } | null;
  cardsDue: number | null;
}) {
  const smashed = map.dailyGoalXp > 0 && map.xpToday >= map.dailyGoalXp;
  const weak = weakSpots(map);
  const studied = days?.filter((d) => d.value > 0).length ?? 0;
  const subject = map.subjectId ?? map.subject;
  const outfit = outfitFor(subject);
  // Pip, the Home button, dresses for this subject too.
  useEffect(() => setPipSubject(subject), [subject]);
  return (
    <>
      <section className="home-hero" aria-label="Where you stand">
        {level ? (
          <Ring
            label={`Level ${level.level}`}
            value={level.xpIntoLevel}
            max={level.xpForNextLevel}
            valueText={`${level.xpIntoLevel} of ${level.xpForNextLevel} XP to level ${level.level + 1}`}
            size={112}
            stroke={13}
            tone="var(--color-primary)"
          >
            <span className="home-ring__kicker">Level</span>
            <b className="home-ring__big">
              <CountUp value={level.level} format={whole} />
            </b>
          </Ring>
        ) : (
          <div className="home-hero__pip" aria-hidden="true">
            <PipFigure outfit={outfit} look={lookFor(new Date().toISOString().slice(0, 10))} />
          </div>
        )}
        <div className="home-hero__side">
          <p className="home-streak">
            <FlameIcon />
            <span>
              <CountUp value={map.streakDays} format={whole} /> day streak
            </span>
          </p>
          <ul className="home-goals" aria-label="Today's goals">
            <li>
              <Ring
                label="Daily goal"
                value={map.xpToday}
                max={map.dailyGoalXp}
                valueText={
                  smashed
                    ? `Goal smashed: ${map.xpToday} XP, goal ${map.dailyGoalXp} XP`
                    : `${map.xpToday} of ${map.dailyGoalXp} XP`
                }
                size={52}
                stroke={7}
                tone="var(--color-gold)"
              >
                <StarIcon />
              </Ring>
              <span className="home-goals__label">
                {smashed ? 'Goal smashed!' : `${map.xpToday}/${map.dailyGoalXp}`}
              </span>
            </li>
            {fiveADay && (
              <li>
                <Ring
                  label="5-a-day"
                  value={fiveADay.answered}
                  max={fiveADay.total}
                  valueText={`${fiveADay.answered} of ${fiveADay.total} done`}
                  size={52}
                  stroke={7}
                  tone="#3cb4ff"
                >
                  <b>5</b>
                </Ring>
                {fiveADay.answered < fiveADay.total ? (
                  <Link
                    to="/learn/daily"
                    className="home-goals__start"
                    aria-label={`${fiveADay.answered > 0 ? 'Continue' : 'Start'} your 5-a-day`}
                  >
                    {fiveADay.answered > 0 ? 'Continue' : 'Start'}
                  </Link>
                ) : (
                  <span className="home-goals__label">Done</span>
                )}
              </li>
            )}
            {cardsDue !== null && (
              <li>
                <Link
                  to="/cards"
                  className="home-goals__cards"
                  aria-label={`Cards: ${cardsDue} due`}
                >
                  <span className="home-goals__cards-icon" aria-hidden="true">
                    <CardsIcon />
                  </span>
                </Link>
                <span className="home-goals__label">{cardsDue} due</span>
              </li>
            )}
          </ul>
        </div>
      </section>

      <section className="home-next" aria-label="Up next">
        <p className="home-next__kicker" aria-hidden="true">
          Up next
        </p>
        {map.nextMission ? (
          <Link to={`/learn/topic/${map.nextMission.lessonId}`} className="home-cta">
            <span className="home-cta__play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26">
                <path d="M6 3l15 9-15 9z" fill="currentColor" />
              </svg>
            </span>
            <span className="home-cta__text">
              <b>
                <span className="visually-hidden">Go: </span>
                {map.nextMission.title}
              </b>
              <span>{map.nextMission.minutes} min</span>
            </span>
          </Link>
        ) : (
          <Link to="/map" className="home-cta">
            <span className="home-cta__text">
              <b>Pick a topic</b>
            </span>
          </Link>
        )}
      </section>

      <div className="home-row-title">
        <h2 id="home-fix">Fix these</h2>
        {/* The rank chip where friends are available (dev only for now, FL); otherwise "Soon". */}
        <LeagueChip
          fallback={
            <span className="home-league">
              <span>Friends league</span> <small>Soon</small>
            </span>
          }
        />
      </div>
      {weak.length > 0 ? (
        <ul className="home-fix" aria-labelledby="home-fix">
          {weak.map((t) => (
            <li key={t.id}>
              <Link to={`/learn/topic/${t.lessonId}`} className="home-fix__chip">
                {t.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="home-fix__none">Nothing to fix. Nice!</p>
      )}

      <ul className="home-extras">
        <InstallRow />
      </ul>

      {days && (
        <>
          <h2 id="home-week" className="home-row-title">
            This week
          </h2>
          <div className="home-week">
            <ol className="home-week__days" aria-labelledby="home-week">
              {days.map((d) => (
                <li key={d.start} className={d.value > 0 ? 'is-on' : undefined}>
                  <span aria-hidden="true">{(WEEKDAYS[d.label] ?? d.label).slice(0, 1)}</span>
                  <span className="visually-hidden">
                    {WEEKDAYS[d.label] ?? d.label}, {d.value > 0 ? 'studied' : 'not yet'}
                  </span>
                </li>
              ))}
            </ol>
            <Link
              to="/rewards"
              className="home-week__gift"
              aria-label={`Rewards: ${studied} of 7 days this week`}
            >
              <svg viewBox="0 0 40 40" width="46" height="46" aria-hidden="true">
                <rect
                  x="5"
                  y="15"
                  width="30"
                  height="21"
                  rx="3"
                  fill="#ff8fb8"
                  stroke="currentColor"
                  strokeWidth="2.5"
                />
                <rect
                  x="3"
                  y="10"
                  width="34"
                  height="7"
                  rx="2"
                  fill="#ffb3cf"
                  stroke="currentColor"
                  strokeWidth="2.5"
                />
                <path d="M20 10v26" stroke="currentColor" strokeWidth="2.5" />
                <path
                  d="M20 10c-4-6-11-5-9 0zM20 10c4-6 11-5 9 0z"
                  fill="#ffe45c"
                  stroke="currentColor"
                  strokeWidth="2.2"
                />
              </svg>
            </Link>
          </div>
        </>
      )}
    </>
  );
}
