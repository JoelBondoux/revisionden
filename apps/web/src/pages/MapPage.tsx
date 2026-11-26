import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApi } from '../api/ApiContext';
import { LoadingOrError } from '../api/LoadingOrError';
import type { MapSubject } from '@revisionden/core';
import { useApiResource } from '../api/useApiResource';
import { FlameIcon } from '../components/icons';
import { Pill } from '../components/Pill';
import { Toast } from '../components/Toast';
import { PipFigure, setPipSubject } from '../features/juice/pip';
import { lookFor, outfitFor } from '../features/juice/pip/outfits';
import { SubjectsNudge } from '../features/onboarding/checksUi';
import { WigglyMap } from '../map/WigglyMap';
import '../map/map.css';
import { useStudent } from '../session/StudentContext';

const today = () => new Date().toISOString().slice(0, 10);

/** The big subject box at the top of the map: Pip dressed for it, and Change (J15c). */
function PlayBox({
  subjectId,
  subject,
  qualification,
  onChange,
}: {
  subjectId: string | undefined;
  subject: string;
  qualification: string;
  onChange: () => void;
}) {
  return (
    <div className="map-play-wrap">
      <button type="button" className="map-play" onClick={onChange}>
        <PipFigure outfit={outfitFor(subjectId ?? subject)} look={lookFor(today())} />
        <span className="map-play__text">
          <small>Your subject</small> <b>{subject}</b>
        </span>{' '}
        <span className="map-play__change">Change</span>
      </button>
      <p className="map-play__qualification">
        {qualification} {subject}
      </p>
    </div>
  );
}

/** Subject selection (J15c): every subject, each with Pip dressed for it. */
function SubjectPicker({
  subjects,
  current,
  onChoose,
  onBack,
}: {
  subjects: readonly MapSubject[];
  current: string | undefined;
  onChoose: (subjectId: string) => void;
  onBack: () => void;
}) {
  const look = lookFor(today());
  return (
    <section className="map-subjects-page" role="region" aria-label="Pick a subject">
      <button type="button" className="btn btn--secondary" onClick={onBack}>
        Back to the map
      </button>
      <h2>Pick a subject</h2>
      <div className="map-subjects-grid">
        {subjects.map((s) => (
          <button
            key={s.subjectId}
            type="button"
            className="map-subject"
            aria-pressed={s.subjectId === current}
            onClick={() => onChoose(s.subjectId)}
          >
            {/* W20: the visible words are the name (WCAG 2.5.3), so speech users can say them. */}
            <PipFigure outfit={outfitFor(s.subjectId)} look={look} />
            <span>{s.subject}</span>
            {!s.hasContent && (
              <>
                {' '}
                <small>Coming soon</small>
              </>
            )}
          </button>
        ))}
      </div>
    </section>
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
  const [picking, setPicking] = useState(false);
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
          {picking ? (
            <SubjectPicker
              subjects={
                map.data.subjects?.length
                  ? map.data.subjects
                  : [
                      {
                        subjectId: map.data.subjectId ?? map.data.subject,
                        subject: map.data.subject,
                        hasContent: true,
                      },
                    ]
              }
              current={map.data.subjectId}
              onChoose={(id) => {
                setPicking(false);
                setSubjectId(id);
              }}
              onBack={() => setPicking(false)}
            />
          ) : (
            <PlayBox
              subjectId={map.data.subjectId}
              subject={map.data.subject}
              qualification={map.data.qualification}
              onChange={() => setPicking(true)}
            />
          )}
          {!picking && map.data.status === 'coming_soon' && (
            <ComingSoon
              subject={map.data.subject}
              other={(map.data.subjects ?? []).find(
                (s) => s.hasContent && s.subjectId !== map.data.subjectId,
              )}
              onChoose={setSubjectId}
            />
          )}
          {!picking && <WigglyMap key={map.data.subjectId} map={map.data} onLocked={setToast} />}
        </>
      )}
      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </div>
  );
}
