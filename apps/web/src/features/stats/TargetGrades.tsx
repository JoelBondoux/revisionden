import { useEffect, useState } from 'react';
import type { SubjectTarget, TargetGrades } from '@revisionden/core';
import { Card } from '../../components/Card';
import { useApiResource } from '../../api/useApiResource';
import { NotSetUp } from './Tile';
import { useStatsApi } from './statsApi';

type Message = { kind: 'saved' | 'error'; text: string } | null;

/** Saves one target and reports it in plain words; the caller swaps in the returned view. */
function useTargetSaver(save: (subjectId: string, grade: string | null) => Promise<TargetGrades>) {
  const [message, setMessage] = useState<Message>(null);
  const run = async (s: SubjectTarget, grade: string, show: (next: TargetGrades) => void) => {
    try {
      show(await save(s.subjectId, grade === '' ? null : grade));
      setMessage({ kind: 'saved', text: `${s.name} target ${grade === '' ? 'cleared' : 'saved'}` });
    } catch {
      setMessage({ kind: 'error', text: 'Could not save. Please try again.' });
    }
  };
  return { message, run };
}

function GradeSelect({
  subject,
  label,
  value,
  onPick,
}: {
  subject: SubjectTarget;
  label: string;
  value: string | null;
  onPick: (grade: string) => void;
}) {
  return (
    <select aria-label={label} value={value ?? ''} onChange={(e) => onPick(e.target.value)}>
      <option value="">No target</option>
      {(subject.grades ?? []).map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </select>
  );
}

function SaveMessage({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p role={message.kind === 'error' ? 'alert' : 'status'} className="secondary-text">
      {message.text}
    </p>
  );
}

/**
 * The parent's target grades panel (workstream K8): the parent's target per subject, chosen from
 * the subject's grade scale and saved at once (either parent can change it), next to the child's
 * own target.
 */
export function TargetGradesPanel({ studentId }: { studentId: string }) {
  const api = useStatsApi();
  const loaded = useApiResource(() => api.getTargetGrades(studentId), [api, studentId]);
  const [view, setView] = useState<TargetGrades | null>(null);
  const { message, run } = useTargetSaver((subjectId, grade) =>
    api.saveTargetGrade(studentId, subjectId, grade),
  );

  useEffect(() => {
    if (loaded.status === 'ready') setView(loaded.data);
  }, [loaded]);

  if (!view) return null;
  return (
    <Card title="Target grades">
      {view.subjects.length === 0 ? (
        <NotSetUp text="No subjects yet." />
      ) : (
        <ul className="stats-list">
          {view.subjects.map((s) =>
            s.grades === null ? (
              <li key={s.subjectId} className="secondary-text">
                {`${s.name}: not available yet`}
              </li>
            ) : (
              <li key={s.subjectId} className="target-row">
                <label className="field no-print">
                  <span>{`${s.name}: your target`}</span>
                  <GradeSelect
                    subject={s}
                    label={`${s.name}: your target`}
                    value={s.parentTarget}
                    onPick={(g) => void run(s, g, setView)}
                  />
                </label>
                <span className="secondary-text">
                  {s.studentTarget === null
                    ? 'They haven’t set their own target yet'
                    : `Their own target: ${s.studentTarget}`}
                </span>
              </li>
            ),
          )}
        </ul>
      )}
      <p className="secondary-text">
        Your child sees both targets on their own stats as goals to reach for. Predicted grades come
        later.
      </p>
      <SaveMessage message={message} />
    </Card>
  );
}

/**
 * The student's target grades on My stats: their parent's target, read-only, and their own
 * target, which they set here. Both are goals to reach for, so nothing is styled as good or bad.
 */
export function MyTargetGrades({ targets }: { targets: SubjectTarget[] }) {
  const api = useStatsApi();
  const [view, setView] = useState<SubjectTarget[]>(targets);
  const { message, run } = useTargetSaver((subjectId, grade) =>
    api.saveMyTargetGrade(subjectId, grade),
  );
  useEffect(() => setView(targets), [targets]);

  return (
    <Card title="Target grades">
      {view.length === 0 ? (
        <NotSetUp text="Your subjects will show here." />
      ) : (
        <ul className="stats-list">
          {view.map((s) =>
            s.grades === null ? (
              <li key={s.subjectId} className="secondary-text">
                {`${s.name}: not available yet`}
              </li>
            ) : (
              <li key={s.subjectId} className="target-row">
                <label className="field">
                  <span>{`${s.name}: my target`}</span>
                  <GradeSelect
                    subject={s}
                    label={`${s.name}: my target`}
                    value={s.studentTarget}
                    onPick={(g) => void run(s, g, (next) => setView(next.subjects))}
                  />
                </label>
                <span className="secondary-text">
                  {s.parentTarget === null
                    ? 'Your parent hasn’t set one yet'
                    : `Your parent’s target: ${s.parentTarget}`}
                </span>
              </li>
            ),
          )}
        </ul>
      )}
      <SaveMessage message={message} />
    </Card>
  );
}
