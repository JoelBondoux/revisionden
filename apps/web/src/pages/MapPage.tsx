import { useCallback, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApi } from '../api/ApiContext';
import { LoadingOrError } from '../api/LoadingOrError';
import type { MapSubject, MapUnit as Unit } from '@revisionden/core';
import { useApiResource } from '../api/useApiResource';
import { FlameIcon } from '../components/icons';
import { Pill } from '../components/Pill';
import { ProgressBar } from '../components/ProgressBar';
import { Toast } from '../components/Toast';
import { honeycombRows } from '../map/honeycomb';
import { DailyCard } from '../features/daily';
import { SubjectsNudge } from '../features/onboarding/checksUi';
import { NextMissionCard } from '../map/NextMissionCard';
import { ChallengeHex, TopicHex } from '../map/TopicHex';
import { useStudent } from '../session/StudentContext';
import { InstallCard } from '../pwa/InstallCard';

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

/** Chips for the student's subjects; a subject without questions yet says so. */
function SubjectSwitcher({
  subjects,
  current,
  onChoose,
}: {
  subjects: readonly MapSubject[];
  current: string | undefined;
  onChoose: (subjectId: string) => void;
}) {
  if (subjects.length < 2) return null;
  return (
    <div role="group" aria-label="Subject" className="chip-row">
      {subjects.map((s) => (
        <button
          key={s.subjectId}
          type="button"
          className="chip"
          aria-pressed={s.subjectId === current}
          onClick={() => onChoose(s.subjectId)}
        >
          {s.hasContent ? s.subject : `${s.subject} (coming soon)`}
        </button>
      ))}
    </div>
  );
}

/** A subject with no questions yet (RD-MBXKTC): a friendly note, never the error screen. */
function ComingSoon({
  subject,
  other,
  onChoose,
}: {
  subject: string;
  other: MapSubject | undefined;
  onChoose: (subjectId: string) => void;
}) {
  return (
    <section className="card map-coming-soon" aria-label="Coming soon">
      <p>Questions for {subject} are on their way.</p>
      {other && (
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => onChoose(other.subjectId)}
        >
          Try {other.subject} meanwhile
        </button>
      )}
    </section>
  );
}

export function MapPage() {
  const api = useApi();
  const { studentId } = useStudent();
  const [toast, setToast] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined);
  const map = useApiResource(
    () => (studentId ? api.getTopicMap(subjectId) : new Promise<never>(() => {})),
    [api, studentId, subjectId],
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
      <SubjectsNudge />
      {map.status !== 'ready' ? (
        <LoadingOrError resource={map} />
      ) : (
        <>
          <SubjectSwitcher
            subjects={map.data.subjects ?? []}
            current={map.data.subjectId}
            onChoose={setSubjectId}
          />
          {map.data.status === 'coming_soon' && (
            <ComingSoon
              subject={map.data.subject}
              other={(map.data.subjects ?? []).find(
                (s) => s.hasContent && s.subjectId !== map.data.subjectId,
              )}
              onChoose={setSubjectId}
            />
          )}
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
          <DailyCard />
          {map.data.nextMission && <NextMissionCard mission={map.data.nextMission} />}
          <InstallCard />
          {map.data.units.map((unit) => (
            <UnitMap key={unit.id} unit={unit} onLocked={setToast} />
          ))}
        </>
      )}
      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </div>
  );
}
