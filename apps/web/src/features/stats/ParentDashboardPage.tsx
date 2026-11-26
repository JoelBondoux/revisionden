import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { resetDayLabel, type ParentDashboard } from '@revisionden/core';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ProgressBar } from '../../components/ProgressBar';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { BarChart } from './BarChart';
import { GrowIn } from './countUp';
import { DailyLimitPanel } from './DailyLimit';
import { ParentRewardsCard } from './ParentRewardsCard';
import { TargetGradesPanel } from './TargetGrades';
import { WorthALookCard } from './WorthALook';
import { formatMinutes, signedNote } from './format';
import { NotSetUp, Tile } from './Tile';
import { useStatsApi, type Child } from './statsApi';
import './stats.css';

/**
 * Parent stats dashboard: one child at a time, this week. Read-only. "Save as PDF" uses the
 * browser's print dialog, so nothing is stored on the server; the page shows nicknames only.
 */
export function ParentDashboardPage() {
  const api = useStatsApi();
  const children = useApiResource(() => api.getChildren(), [api]);
  return (
    <div className="stack stats">
      <h1>Stats dashboard</h1>
      {children.status === 'ready' ? (
        children.data.length === 0 ? (
          <NotSetUp text="No children yet." link={{ to: '/onboarding', label: 'Add a child' }} />
        ) : (
          <ChildDashboard choices={children.data} />
        )
      ) : (
        <LoadingOrError resource={children} />
      )}
    </div>
  );
}

function ChildDashboard({ choices }: { choices: Child[] }) {
  const api = useStatsApi();
  // "Who's revising?" opens this page with ?student=<id> for the child the parent tapped.
  const [params] = useSearchParams();
  const asked = params.get('student');
  const [childId, setChildId] = useState(choices.find((c) => c.id === asked)?.id ?? choices[0]!.id);
  const dashboard = useApiResource(() => api.getDashboard(childId), [api, childId]);
  // Targets saved in the panel below, shown in the subjects table without reloading the page.
  const [savedTargets, setSavedTargets] = useState<Map<string, string | null>>(new Map());
  useEffect(() => setSavedTargets(new Map()), [childId]);
  return (
    <>
      <div className="stats-toolbar no-print">
        {choices.length > 1 && (
          <label className="field">
            <span>Student</span>
            <select value={childId} onChange={(e) => setChildId(e.target.value)}>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button variant="secondary" onClick={() => window.print()}>
          Save as PDF
        </Button>
      </div>
      {dashboard.status === 'ready' ? (
        <>
          <DashboardView data={dashboard.data} savedTargets={savedTargets} />
          <DailyLimitPanel key={childId} studentId={childId} />
          <TargetGradesPanel
            key={`targets-${childId}`}
            studentId={childId}
            onSaved={(next) =>
              setSavedTargets(new Map(next.subjects.map((t) => [t.subjectId, t.parentTarget])))
            }
          />
        </>
      ) : (
        <LoadingOrError resource={dashboard} />
      )}
    </>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function minutesNote(current: number, previous: number): string {
  const diff = current - previous;
  if (diff === 0) return 'Same as last week';
  return diff > 0
    ? `${formatMinutes(diff)} more than last week`
    : `${formatMinutes(-diff)} less than last week`;
}

function grade(predicted: string | null, target: string | null): string {
  // Predicted grades wait for verified grade boundaries; a target can already be set (K8).
  if (predicted === null) return target === null ? 'Not set up yet' : `Target ${target}`;
  return target === null ? predicted : `${predicted} (target ${target})`;
}

const ACTIVITY: Record<ParentDashboard['recentActivity'][number]['kind'], [string, string]> = {
  lesson: ['Lesson', 'question'],
  test: ['Test', 'question'],
  starting_test: ['Starting test', 'question'],
  flashcards: ['Flashcards', 'review'],
};

function DashboardView({
  data,
  savedTargets,
}: {
  data: ParentDashboard;
  savedTargets: ReadonlyMap<string, string | null>;
}) {
  const { tiles, studyTime, healthyHabits: habits, aiAllowance } = data;
  const subjectName = new Map(data.subjects.map((s) => [s.subjectId, s.name]));
  const when = new Intl.DateTimeFormat('en-GB', {
    timeZone: data.timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <>
      <h2>{data.student.nickname}</h2>
      <p className="secondary-text">{data.week.label}</p>
      <div className="stat-tiles">
        <Tile
          label="Active study time"
          count={{ value: tiles.activeMinutes.value, format: formatMinutes }}
          index={0}
          of={4}
          note={minutesNote(tiles.activeMinutes.value, tiles.activeMinutes.previous)}
        />
        <Tile
          label="Plan kept"
          value="–"
          count={
            tiles.planKept && {
              value: tiles.planKept.done,
              format: (n) => `${n} of ${tiles.planKept!.planned}`,
            }
          }
          index={1}
          of={4}
          note={tiles.planKept ? 'sessions done' : 'No plan yet'}
        />
        <Tile
          label="Accuracy"
          value="–"
          count={
            tiles.accuracy.value === null
              ? null
              : { value: tiles.accuracy.value, format: (n) => `${n}%` }
          }
          index={2}
          of={4}
          note={signedNote(tiles.accuracy.value, tiles.accuracy.previous)}
        />
        <Tile
          label="Streak"
          count={{ value: tiles.streak.current, format: (n) => plural(n, 'day') }}
          index={3}
          of={4}
          note={`best ${tiles.streak.best}`}
        />
      </div>

      <Card title="Study time">
        <BarChart
          title="Study time, last 8 weeks"
          buckets={studyTime.weeks}
          unit="min"
          format={formatMinutes}
          reference={
            studyTime.planMinutes === null
              ? null
              : { value: studyTime.planMinutes, label: 'Weekly plan' }
          }
        />
      </Card>

      <Card title="Subjects">
        {data.subjects.length === 0 ? (
          <NotSetUp text="No lessons yet." />
        ) : (
          <table className="stats-table">
            <caption className="visually-hidden">Subjects</caption>
            <thead>
              <tr>
                <th scope="col">Subject</th>
                <th scope="col">Mastery</th>
                <th scope="col">Predicted grade</th>
                <th scope="col">Last 4 weeks</th>
              </tr>
            </thead>
            <tbody>
              {data.subjects.map((s) => (
                <tr key={s.subjectId}>
                  <th scope="row">{s.name}</th>
                  <td>{s.mastery}%</td>
                  <td>
                    {grade(
                      s.predictedGrade,
                      savedTargets.has(s.subjectId)
                        ? (savedTargets.get(s.subjectId) ?? null)
                        : s.targetGrade,
                    )}
                  </td>
                  <td>{s.change > 0 ? `+${s.change}` : String(s.change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Weak spots">
        {data.weakSpots.length === 0 ? (
          <NotSetUp text="No weak spots yet." />
        ) : (
          <ul className="stats-list">
            {data.weakSpots.map((w) => (
              <li key={w.topicId} className="stats-list__row">
                <span>
                  {w.title}
                  <span className="secondary-text">{` · ${subjectName.get(w.subjectId) ?? ''}`}</span>
                </span>
                <span>{`${w.then}% → ${w.now}%`}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="secondary-text">4 weeks ago → now</p>
      </Card>

      <WorthALookCard key={data.student.id} studentId={data.student.id} />

      <Card title="School report effort">
        {data.effortScores ? (
          <ul className="stats-list">
            {data.effortScores.scores.map((s) => (
              <li key={s.label}>{`${s.label}: ${s.value} (${s.scale})`}</li>
            ))}
          </ul>
        ) : (
          <NotSetUp link={{ to: '/onboarding', label: 'Add a school report' }} />
        )}
      </Card>

      <ParentRewardsCard key={data.student.id} studentId={data.student.id} />

      <Card title="Healthy habits">
        <ul className="stats-list">
          <li>{`${plural(habits.quietHourSessions, 'session')} in quiet hours`}</li>
          <li>{`${plural(habits.daysOverCap, 'day')} at the daily limit (${habits.dailyCapMinutes} minutes today)`}</li>
          <li>{`${plural(habits.restDays, 'rest day')} taken`}</li>
        </ul>
      </Card>

      <AiAllowanceCard allowance={aiAllowance} />

      <Card title="Recent activity">
        {data.recentActivity.length === 0 ? (
          <NotSetUp text="Nothing yet this week." />
        ) : (
          <ul className="stats-list">
            {data.recentActivity.map((a) => {
              const [label, unit] = ACTIVITY[a.kind];
              const subject = a.subjectId ? subjectName.get(a.subjectId) : undefined;
              return (
                <li key={`${a.kind}-${a.at}`} className="stats-list__row">
                  <span>{`${label}${subject ? ` in ${subject}` : ''}: ${plural(a.count, unit)}`}</span>
                  <span className="secondary-text">{when.format(new Date(a.at))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

/**
 * The AI marking allowance (workstream K9): the monthly cap as a percentage used and its reset
 * date. Families never see money, spend or cost for AI.
 */
function AiAllowanceCard({ allowance }: { allowance: ParentDashboard['aiAllowance'] }) {
  const { percentUsed, usedUp, resetsOn } = allowance;
  const resetDay = resetDayLabel(resetsOn);
  return (
    <Card title="AI marking allowance">
      <GrowIn>
        <ProgressBar
          label="AI marking allowance"
          value={percentUsed}
          max={100}
          valueText={`${percentUsed}% used`}
        />
      </GrowIn>
      <p className="secondary-text">
        {usedUp
          ? `This month’s AI marking allowance is used up. It resets on ${resetDay}.`
          : `${percentUsed}% used this month. Resets on ${resetDay}.`}
      </p>
    </Card>
  );
}
