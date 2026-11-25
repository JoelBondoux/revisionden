import { useState } from 'react';
import { kindChange, STATS_PERIODS, type StatsPeriod, type StudentStats } from '@revisionden/core';
import { Card } from '../../components/Card';
import { ProgressBar } from '../../components/ProgressBar';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { BarChart } from './BarChart';
import { DailyLimitToday } from './DailyLimit';
import { MyTargetGrades } from './TargetGrades';
import { kindNote } from './format';
import { NotSetUp, Tile } from './Tile';
import { useStatsApi } from './statsApi';
import './stats.css';

const PERIOD_LABELS: Record<StatsPeriod, string> = { week: 'Week', term: 'Term', year: 'Year' };
const CHART_TITLES: Record<StatsPeriod, string> = {
  week: 'XP per day',
  term: 'XP per week',
  year: 'XP per month',
};
const GOAL_LABELS: Record<StatsPeriod, string> = {
  week: 'Daily goal',
  term: 'Weekly goal',
  year: '',
};
const SINCE: Record<StatsPeriod, string> = {
  week: 'this week',
  term: 'this term',
  year: 'this year',
};

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/**
 * Student "My stats" (Progress tab). Kind framing: gains and "same" only, never red or
 * "worse"; drops are shown to the parent and in the topic list, not here.
 */
export function MyStatsPage() {
  const api = useStatsApi();
  const [period, setPeriod] = useState<StatsPeriod>('week');
  const stats = useApiResource(() => api.getMyStats(period), [api, period]);

  return (
    <div className="stack stats">
      <h1>My stats</h1>
      <DailyLimitToday />
      <div role="group" aria-label="Period" className="period-toggle">
        {STATS_PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === period}
            className="period-toggle__button"
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      {stats.status === 'ready' ? (
        <StatsView stats={stats.data} />
      ) : (
        <LoadingOrError resource={stats} />
      )}
    </div>
  );
}

function StatsView({ stats }: { stats: StudentStats }) {
  const { period, tiles, chart, personalBests: bests, level } = stats;
  const goal = chart.goal === null ? null : { value: chart.goal, label: GOAL_LABELS[period] };
  return (
    <>
      <p className="secondary-text">{stats.range.label}</p>
      <div className="stat-tiles">
        <Tile
          label="XP"
          value={String(tiles.xp.value)}
          note={kindNote(tiles.xp.value, tiles.xp.previous, period)}
        />
        <Tile
          label="Questions"
          value={String(tiles.answered.value)}
          note={[
            `${tiles.answered.correct} correct`,
            kindNote(tiles.answered.value, tiles.answered.previous, period),
          ]
            .filter(Boolean)
            .join(' · ')}
        />
        <Tile
          label="Accuracy"
          value={tiles.accuracy.value === null ? '–' : `${tiles.accuracy.value}%`}
          note={
            tiles.accuracy.value === null
              ? 'No marked answers yet'
              : kindNote(tiles.accuracy.value, tiles.accuracy.previous, period)
          }
        />
        <Tile label="Streak" value={days(tiles.streak.current)} />
      </div>

      <Card title={CHART_TITLES[period]}>
        <BarChart title={CHART_TITLES[period]} buckets={chart.buckets} unit="XP" reference={goal} />
      </Card>

      <Card title="Mastery by subject">
        {stats.mastery.length === 0 ? (
          <NotSetUp text="Start a lesson to see your mastery here." />
        ) : (
          <ul className="stats-list">
            {stats.mastery.map((m) => {
              const change = kindChange(m.mastery, m.mastery - m.change);
              return (
                <li key={m.subjectId}>
                  <div className="stats-list__row">
                    <span>{m.name}</span>
                    <span>{m.mastery}%</span>
                  </div>
                  <ProgressBar label={`${m.name} mastery`} value={m.mastery} max={100} />
                  {change.trend === 'up' && (
                    <span className="stat-tile__note">{`+${change.by} ${SINCE[period]}`}</span>
                  )}
                  {change.trend === 'same' && <span className="stat-tile__note">Same</span>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <MyTargetGrades targets={stats.targets} />

      <Card title="Personal bests">
        <dl className="stats-facts">
          <dt>Longest streak</dt>
          <dd>{bests.longestStreak > 0 ? days(bests.longestStreak) : 'Not yet'}</dd>
          <dt>Most correct answers</dt>
          <dd>{bests.longestCorrectRun > 0 ? `${bests.longestCorrectRun} in a row` : 'Not yet'}</dd>
          <dt>Best week</dt>
          <dd>{bests.bestWeek ? `${bests.bestWeek.xp} XP` : 'Not yet'}</dd>
        </dl>
      </Card>

      <Card title="Level">
        {level ? (
          <ProgressBar
            label={`Level ${level.level}`}
            value={level.xpIntoLevel}
            max={level.xpForNextLevel}
            valueText={`${level.xpIntoLevel} of ${level.xpForNextLevel} XP to level ${level.level + 1}`}
            tone="gold"
          />
        ) : (
          <NotSetUp />
        )}
      </Card>
    </>
  );
}
