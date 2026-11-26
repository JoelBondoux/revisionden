import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApi } from '../api/ApiContext';
import { LoadingOrError } from '../api/LoadingOrError';
import type { MapSubject } from '@revisionden/core';
import { useApiResource } from '../api/useApiResource';
import { FlameIcon } from '../components/icons';
import { Pill } from '../components/Pill';
import { Toast } from '../components/Toast';
import { setPipSubject } from '../features/juice/pip';
import { SubjectsNudge } from '../features/onboarding/checksUi';
import { HScroller } from '../map/HScroller';
import { UnitPath } from '../map/UnitPath';
import '../map/map.css';
import { useStudent } from '../session/StudentContext';

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
    <HScroller label="Subject" selectedKey={current} className="map-subjects">
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
    </HScroller>
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
  // Pip, the Home button, dresses for the subject on the map (J15b).
  const shownSubject = map.status === 'ready' ? (map.data.subjectId ?? map.data.subject) : null;
  useEffect(() => {
    if (shownSubject) setPipSubject(shownSubject);
  }, [shownSubject]);

  if (!studentId) return <Navigate to="/family" replace />;

  return (
    <div className="stack map-page">
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
          <UnitPath key={map.data.subjectId} map={map.data} onLocked={setToast} />
        </>
      )}
      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </div>
  );
}
