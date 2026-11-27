import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../api/ApiContext';
import { Sheet } from '../../components/Sheet';
import { useStudent } from '../../session/StudentContext';
import {
  chooseSubject,
  pickerOrder,
  reportMap,
  useChosenSubject,
  useKnownSubjects,
} from './chosenSubject';
import './subjects.css';

/**
 * UX-1: the current subject as a button in the top bar ("Maths ▾"). It opens a short sheet: the
 * student's subjects (tap to switch), then "Add or change subjects", the map's subject picker.
 * On a screen that loads no map of its own (Cards), it asks for one so it knows the subjects.
 */
export function SubjectSwitcher() {
  const api = useApi();
  const navigate = useNavigate();
  const { studentId } = useStudent();
  const chosen = useChosenSubject(studentId);
  const known = useKnownSubjects();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const needsMap = !known || (chosen !== undefined && known.current.subjectId !== chosen);
  useEffect(() => {
    if (!studentId || !needsMap) return;
    let live = true;
    api
      .getTopicMap(chosen)
      .then((map) => live && reportMap(studentId, map))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [api, studentId, chosen, needsMap]);

  if (!known) return null;
  const current = known.current;
  const { now, later } = pickerOrder(known.subjects, current.subjectId);
  const ordered = [...now, ...later];
  return (
    <>
      <button
        type="button"
        className="subject-switcher"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {current.subject} <span aria-hidden="true">▾</span>
        <span className="visually-hidden">, change subject</span>
      </button>
      <Sheet open={open} title="Your subjects" onClose={close}>
        <ul className="subject-switcher__list">
          {ordered.map((s) => (
            <li key={s.subjectId}>
              <button
                type="button"
                className="subject-switcher__subject"
                aria-pressed={s.subjectId === current.subjectId}
                onClick={() => {
                  chooseSubject(studentId, s.subjectId);
                  close();
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
            close();
            navigate('/map', { state: { pickSubject: true } });
          }}
        >
          Add or change subjects
        </button>
      </Sheet>
    </>
  );
}
