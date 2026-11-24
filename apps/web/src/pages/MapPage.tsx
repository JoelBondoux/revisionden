import { useCallback, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApi } from '../api/ApiContext';
import { LoadingOrError } from '../api/LoadingOrError';
import type { Unit } from '../api/schemas';
import { useApiResource } from '../api/useApiResource';
import { FlameIcon } from '../components/icons';
import { Pill } from '../components/Pill';
import { ProgressBar } from '../components/ProgressBar';
import { Toast } from '../components/Toast';
import { honeycombRows } from '../map/honeycomb';
import { NextMissionCard } from '../map/NextMissionCard';
import { ChallengeHex, TopicHex } from '../map/TopicHex';
import { useStudent } from '../session/StudentContext';

/** Hexes in the widest honeycomb row. Three fit a 360px phone; CSS handles the rest. */
const HEXES_PER_ROW = 3;

type MapCell = { kind: 'topic'; topic: Unit['topics'][number] } | { kind: 'challenge' };

function UnitMap({ unit, onLocked }: { unit: Unit; onLocked: (message: string) => void }) {
  const headingId = `unit-${unit.id}`;
  const cells: MapCell[] = [
    ...unit.topics.map((topic) => ({ kind: 'topic' as const, topic })),
    { kind: 'challenge' as const },
  ];
  return (
    <section className="unit" aria-labelledby={headingId}>
      <div className="unit__header">
        <h2 id={headingId}>{unit.title}</h2>
        <p className="unit__mastery">{unit.masteryPercent}% mastered</p>
      </div>
      <div className="honeycomb">
        {honeycombRows(cells, HEXES_PER_ROW).map((row, r) => (
          <ul key={r} className="honeycomb__row">
            {row.map((cell) => (
              <li key={cell.kind === 'topic' ? cell.topic.id : 'challenge'}>
                {cell.kind === 'topic' ? (
                  <TopicHex topic={cell.topic} onLocked={onLocked} />
                ) : (
                  <ChallengeHex
                    unitTitle={unit.title}
                    challenge={unit.challenge}
                    onLocked={onLocked}
                  />
                )}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}

export function MapPage() {
  const api = useApi();
  const { studentId } = useStudent();
  const [toast, setToast] = useState<string | null>(null);
  const map = useApiResource(
    () => (studentId ? api.getTopicMap(studentId) : new Promise<never>(() => {})),
    [api, studentId],
  );
  const dismissToast = useCallback(() => setToast(null), []);

  if (!studentId) return <Navigate to="/family" replace />;

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Topic map</h1>
        {map.status === 'ready' && (
          <Pill tone="streak">
            <FlameIcon />
            {map.data.streakDays} day streak
          </Pill>
        )}
      </div>
      {map.status !== 'ready' ? (
        <LoadingOrError resource={map} />
      ) : (
        <>
          <div className="map-summary">
            <p className="map-summary__subject">
              {map.data.qualification} {map.data.subject}
            </p>
            <ProgressBar
              label="Daily goal"
              tone="gold"
              value={map.data.xpToday}
              max={map.data.dailyGoalXp}
              valueText={`${map.data.xpToday} of ${map.data.dailyGoalXp} XP`}
            />
            <p className="secondary-text">
              Daily goal: {map.data.xpToday} / {map.data.dailyGoalXp} XP
            </p>
          </div>
          {map.data.nextMission && <NextMissionCard mission={map.data.nextMission} />}
          {map.data.units.map((unit) => (
            <UnitMap key={unit.id} unit={unit} onLocked={setToast} />
          ))}
        </>
      )}
      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </div>
  );
}
