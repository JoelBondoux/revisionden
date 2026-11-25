import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { ChildReminderSettings, ParentRewardNews } from '../notifications';
import { NotSetUp } from '../stats/Tile';
import { useStatsApi, type Child } from '../stats/statsApi';
import './parent.css';

/**
 * Parent home (workstream P): the parent's way in to everything that is theirs. Shows nicknames
 * only. Links to pages that exist today; focus suggestions and data export are not built yet.
 */
export function ParentHomePage() {
  const api = useStatsApi();
  const children = useApiResource(() => api.getChildren(), [api]);
  return (
    <div className="stack parent-home">
      <h1>Parent home</h1>
      {children.status === 'ready' ? (
        children.data.length === 0 ? (
          <Card title="Your children">
            <NotSetUp text="No children yet." link={{ to: '/onboarding', label: 'Add a child' }} />
          </Card>
        ) : (
          <ChildCard choices={children.data} />
        )
      ) : (
        <LoadingOrError resource={children} />
      )}
      <div className="parent-home__grid">
        <Card title="Progress">
          <ul className="link-list">
            <li>
              <Link to="/parent/stats">Stats dashboard</Link>
            </li>
          </ul>
        </Card>
        <Card title="Family">
          <ul className="link-list">
            <li>
              <Link to="/onboarding">Add or manage children</Link>
            </li>
            <li>
              <Link to="/feedback/family">Family feedback</Link>
            </li>
          </ul>
        </Card>
        <ParentRewardNews />
        <Card title="Settings and policies">
          <ul className="link-list">
            <li>
              <Link to="/settings">App settings</Link>
            </li>
            <li>
              <Link to="/legal">Policies</Link>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function ChildCard({ choices }: { choices: Child[] }) {
  const [childId, setChildId] = useState(choices[0]!.id);
  const child = choices.find((c) => c.id === childId) ?? choices[0]!;
  const id = encodeURIComponent(child.id);
  return (
    <>
      {choices.length > 1 && (
        <label className="field parent-home__switcher">
          <span>Student</span>
          <select value={child.id} onChange={(e) => setChildId(e.target.value)}>
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname}
              </option>
            ))}
          </select>
        </label>
      )}
      <Card title={child.nickname} className="parent-home__child">
        <ul className="link-list">
          <li>
            <Link to={`/family/${id}/rewards`}>Rewards you set</Link>
          </li>
          <li>
            <Link to={`/parent/reminders/${id}`}>Reminder times</Link>
          </li>
        </ul>
      </Card>
    </>
  );
}

/** One child's reminder times and quiet hours (also used for the parent's reward news). */
export function ParentRemindersPage() {
  const { studentId = '' } = useParams();
  return (
    <div className="stack">
      <h1>Reminder times</h1>
      <ChildReminderSettings studentId={studentId} />
      <Link to="/parent">Back to parent home</Link>
    </div>
  );
}
