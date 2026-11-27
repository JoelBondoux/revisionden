import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
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
import {
  chooseSubject,
  loadSubjectMap,
  pickerOrder,
  reportMap,
  useChosenSubject,
} from '../features/subjects';

const today = () => new Date().toISOString().slice(0, 10);

/** "GCSE Higher" → "Higher"; a qualification with no level after it is shown whole (UX-2). */
export function levelOf(qualification: string): string {
  const level = qualification.replace(/^(GCSE|A-Level|AS-Level)\s+/i, '').trim();
  return level || qualification;
}

/**
 * The map's one compact line (UX-2, owner-approved UX report): the subject and level as a button
 * that changes subject, then the streak. It replaced the title row, the big subject box and the
 * qualification line, which took 40% of a 412 × 915 phone before the path began.
 */
function MapBar({
  subject,
  qualification,
  streakDays,
  onChange,
}: {
  subject: string;
  qualification: string;
  streakDays: number;
  onChange: () => void;
}) {
  return (
    <div className="map-bar">
      <button type="button" className="map-bar__subject" onClick={onChange}>
        {subject} · {levelOf(qualification)}
        <span className="visually-hidden"> (change subject)</span>
        <span className="map-bar__caret" aria-hidden="true">
          ▾
        </span>
      </button>
      <Pill tone="streak">
        <FlameIcon />
        {streakDays} day streak
      </Pill>
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
  // UX-1: the current subject first, then the others with questions, then one folded line.
  const { now, later } = pickerOrder(subjects, current);
  const choice = (s: MapSubject) => (
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
  );
  return (
    <section className="map-subjects-page" role="region" aria-label="Pick a subject">
      <button type="button" className="btn btn--secondary" onClick={onBack}>
        Back to the map
      </button>
      <h2>Pick a subject</h2>
      <div className="map-subjects-grid">{now.map(choice)}</div>
      {later.length > 0 && (
        <details className="map-subjects-later">
          <summary>
            {later.length} more {later.length === 1 ? 'subject' : 'subjects'} coming soon
          </summary>
          <div className="map-subjects-grid">{later.map(choice)}</div>
        </details>
      )}
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
  // UX-1: the subject is the one chosen on this device, shared with Home and Cards; the top
  // bar's "Add or change subjects" opens the picker straight away.
  const subjectId = useChosenSubject(studentId);
  const setSubjectId = useCallback((id: string) => chooseSubject(studentId, id), [studentId]);
  const location = useLocation();
  const askedToPick = (location.state as { pickSubject?: boolean } | null)?.pickSubject === true;
  const [picking, setPicking] = useState(askedToPick);
  // Also when already on the map: each navigation from the top bar has its own key.
  useEffect(() => {
    if (askedToPick) setPicking(true);
  }, [askedToPick, location.key]);
  const map = useApiResource(
    () =>
      studentId
        ? loadSubjectMap((id) => api.getTopicMap(id), studentId, subjectId)
        : new Promise<never>(() => {}),
    [api, studentId, subjectId],
  );
  const dismissToast = useCallback(() => setToast(null), []);
  // Pip, the Home button, dresses for the subject on the map (J15b).
  const shownSubject = map.status === 'ready' ? (map.data.subjectId ?? map.data.subject) : null;
  useEffect(() => {
    if (shownSubject) setPipSubject(shownSubject);
  }, [shownSubject]);
  useEffect(() => {
    if (map.status === 'ready') reportMap(studentId, map.data);
  }, [map, studentId]);

  if (!studentId) return <Navigate to="/family" replace />;

  return (
    <div className="stack map-page">
      <h1 className="visually-hidden">Topic map</h1>
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
            <MapBar
              subject={map.data.subject}
              qualification={map.data.qualification}
              streakDays={map.data.streakDays}
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
