import { useEffect, useState } from 'react';
import type { ParentTargetGrades, StudentStats } from '@revisionden/core';
import { Card } from '../../components/Card';
import { useApiResource } from '../../api/useApiResource';
import { NotSetUp } from './Tile';
import { useStatsApi } from './statsApi';

/**
 * The parent's target grades panel (workstream K8): one choice per enrolled subject, from that
 * subject's grade scale. Saving happens as soon as a grade is picked. Either parent can change it.
 */
export function TargetGradesPanel({ studentId }: { studentId: string }) {
  const api = useStatsApi();
  const loaded = useApiResource(() => api.getTargetGrades(studentId), [api, studentId]);
  const [view, setView] = useState<ParentTargetGrades | null>(null);
  const [message, setMessage] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (loaded.status === 'ready') setView(loaded.data);
  }, [loaded]);

  if (!view) return null;
  const save = async (subjectId: string, name: string, grade: string) => {
    try {
      setView(await api.saveTargetGrade(studentId, subjectId, grade === '' ? null : grade));
      setMessage({ kind: 'saved', text: `${name} target ${grade === '' ? 'cleared' : 'saved'}` });
    } catch {
      setMessage({ kind: 'error', text: 'Could not save. Please try again.' });
    }
  };

  return (
    <Card title="Target grades">
      {view.subjects.length === 0 ? (
        <NotSetUp text="No subjects yet." />
      ) : (
        <ul className="stats-list no-print">
          {view.subjects.map((s) =>
            s.grades === null ? (
              <li key={s.subjectId} className="secondary-text">
                {`${s.name}: not available yet`}
              </li>
            ) : (
              <li key={s.subjectId}>
                <label className="field">
                  <span>{s.name}</span>
                  <select
                    aria-label={`${s.name} target grade`}
                    value={s.targetGrade ?? ''}
                    onChange={(e) => void save(s.subjectId, s.name, e.target.value)}
                  >
                    <option value="">No target</option>
                    {s.grades.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ),
          )}
        </ul>
      )}
      <p className="secondary-text">
        Your child sees their targets on their own stats. Predicted grades come later.
      </p>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className="secondary-text">
          {message.text}
        </p>
      )}
    </Card>
  );
}

/** The student's target grades on My stats: read-only. */
export function MyTargetGrades({ targets }: { targets: StudentStats['targets'] }) {
  return (
    <Card title="Target grades">
      {targets.length === 0 ? (
        <NotSetUp text="No target grades yet. A parent can set them." />
      ) : (
        <ul className="stats-list">
          {targets.map((t) => (
            <li key={t.subjectId}>{`${t.name}: ${t.targetGrade}`}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
