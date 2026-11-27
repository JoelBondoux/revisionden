import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../api/ApiContext';
import { Sheet } from '../../components/Sheet';
import { useStudent } from '../../session/StudentContext';
import {
  chooseSubject,
  loadSubjectMap,
  pickerOrder,
  reportMap,
  useChosenSubject,
  useKnownSubjects,
} from './chosenSubject';
import './subjects.css';

/**
 * The student's subjects as a short sheet (UX-1): tap one to switch (it becomes the remembered
 * subject every screen shows), then "Add or change subjects", the map's subject picker. Any
 * screen can open it, for example the map header (UX-2). It knows the subjects once a screen has
 * loaded a map; SubjectSwitcher loads one where nothing else has.
 */
export function SubjectSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { studentId } = useStudent();
  const known = useKnownSubjects(studentId);
  if (!known) return null;
  const current = known.current;
  const { now, later } = pickerOrder(known.subjects, current.subjectId);
  return (
    <Sheet open={open} title="Your subjects" onClose={onClose}>
      <ul className="subject-switcher__list">
        {[...now, ...later].map((s) => (
          <li key={s.subjectId}>
            <button
              type="button"
              className="subject-switcher__subject"
              aria-pressed={s.subjectId === current.subjectId}
              onClick={() => {
                chooseSubject(studentId, s.subjectId);
                onClose();
              }}
            >
              {s.subject}
              {!s.hasContent && (
                <>
                  {' '}
                  <small>Coming soon</small>
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn--secondary subject-switcher__more"
        onClick={() => {
          onClose();
          navigate('/map', { state: { pickSubject: true } });
        }}
      >
        Add or change subjects
      </button>
    </Sheet>
  );
}

/**
 * UX-1: the current subject as a button in the top bar ("Maths ▾"), opening SubjectSheet. On a
 * screen that loads no map of its own (Cards), it asks for one so it knows the subjects.
 */
export function SubjectSwitcher() {
  const api = useApi();
  const { studentId } = useStudent();
  const chosen = useChosenSubject(studentId);
  const known = useKnownSubjects(studentId);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const needsMap = !known || (chosen !== undefined && known.current.subjectId !== chosen);
  useEffect(() => {
    if (!studentId || !needsMap) return;
    let live = true;
    loadSubjectMap((id) => api.getTopicMap(id), studentId, chosen)
      .then((map) => live && reportMap(studentId, map))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [api, studentId, chosen, needsMap]);

  if (!known) return null;
  return (
    <>
      <button
        type="button"
        className="subject-switcher"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {known.current.subject} <span aria-hidden="true">▾</span>
        <span className="visually-hidden">, change subject</span>
      </button>
      <SubjectSheet open={open} onClose={close} />
    </>
  );
}
