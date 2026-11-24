import { useCallback, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApi } from '../api/ApiContext';
import { LoadingOrError } from '../api/LoadingOrError';
import type { PathNode } from '../api/schemas';
import { useApiResource } from '../api/useApiResource';
import { CheckIcon, AlertIcon, FlameIcon, LockIcon, StarIcon } from '../components/icons';
import { Pill } from '../components/Pill';
import { ProgressBar } from '../components/ProgressBar';
import { Toast } from '../components/Toast';
import { useStudent } from '../session/StudentContext';

const statusLabel: Record<PathNode['status'], string> = {
  done: 'done',
  weak: 'weak spot',
  current: 'start lesson',
  locked: 'locked',
};

const statusIcon = {
  done: CheckIcon,
  weak: AlertIcon,
  current: StarIcon,
  locked: LockIcon,
} as const;

function PathNodeView({ node, onLocked }: { node: PathNode; onLocked: (node: PathNode) => void }) {
  const Icon = statusIcon[node.status];
  const label = `${node.title}, ${statusLabel[node.status]}`;
  const content = (
    <>
      <span className="path-node__bubble">
        <Icon />
      </span>
      <span className="path-node__title" aria-hidden="true">
        {node.title}
      </span>
      {node.status === 'weak' && (
        <span aria-hidden="true">
          <Pill tone="warning">Weak spot</Pill>
        </span>
      )}
    </>
  );
  const className = `path-node path-node--${node.status}`;

  if (node.status === 'locked') {
    return (
      <button type="button" className={className} aria-label={label} onClick={() => onLocked(node)}>
        {content}
      </button>
    );
  }
  return (
    <Link to={`/lesson/${node.lessonId}`} className={className} aria-label={label}>
      {content}
    </Link>
  );
}

export function PathPage() {
  const api = useApi();
  const { studentId } = useStudent();
  const [toast, setToast] = useState<string | null>(null);
  const path = useApiResource(
    () => (studentId ? api.getPath(studentId) : new Promise<never>(() => {})),
    [api, studentId],
  );
  const dismissToast = useCallback(() => setToast(null), []);

  if (!studentId) return <Navigate to="/family" replace />;

  return (
    <div className="stack">
      <div className="page-header">
        <h1>Your path</h1>
        {path.status === 'ready' && (
          <Pill tone="streak">
            <FlameIcon />
            {path.data.streakDays} day streak
          </Pill>
        )}
      </div>
      {path.status !== 'ready' ? (
        <LoadingOrError resource={path} />
      ) : (
        <>
          <div className="path-summary">
            <p className="path-summary__subject">
              {path.data.qualification} {path.data.subject}
            </p>
            <ProgressBar
              label="Daily goal"
              tone="gold"
              value={path.data.xpToday}
              max={path.data.dailyGoalXp}
              valueText={`${path.data.xpToday} of ${path.data.dailyGoalXp} XP`}
            />
            <p className="secondary-text">
              Daily goal: {path.data.xpToday} / {path.data.dailyGoalXp} XP
            </p>
          </div>
          {path.data.units.map((unit) => (
            <section key={unit.id} className="path-unit" aria-labelledby={`unit-${unit.id}`}>
              <h2 id={`unit-${unit.id}`} className="path-unit__title">
                {unit.title}
              </h2>
              <ol className="path-nodes">
                {unit.nodes.map((node) => (
                  <li key={node.id}>
                    <PathNodeView
                      node={node}
                      onLocked={(n) =>
                        setToast(`Finish the lessons before ${n.title} to unlock it.`)
                      }
                    />
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </>
      )}
      {toast && <Toast message={toast} onDismiss={dismissToast} />}
    </div>
  );
}
