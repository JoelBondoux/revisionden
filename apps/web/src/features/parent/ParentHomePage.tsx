import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import {
  BackIcon,
  BellIcon,
  ChatIcon,
  CrownIcon,
  DownloadIcon,
  HeartIcon,
  ProgressIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
} from '../../components/icons';
import { LinkButton, LinkTile } from '../../components/links';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { ChildReminderSettings, ParentRewardNews } from '../notifications';
import { NotSetUp } from '../stats/Tile';
import { useStatsApi, type Child } from '../stats/statsApi';
import { FamilyLog, ParentsPanel, RemovalNotice } from '../parents';
import { ThingsToCheckCard } from '../onboarding/checksUi';
import './parent.css';

/**
 * Parent home (workstream P): the parent's way in to everything that is theirs. Shows nicknames
 * only. Links to pages that exist today; focus suggestions are not built yet. The data export
 * download is on the onboarding family list (workstream B2).
 */
export function ParentHomePage() {
  const api = useStatsApi();
  const children = useApiResource(() => api.getChildren(), [api]);
  const navigate = useNavigate();
  return (
    <div className="stack parent-home">
      <h1>Parent home</h1>
      <RemovalNotice onDone={() => window.location.reload()} />
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
      <ThingsToCheckCard />
      <div className="parent-home__grid">
        <Card title="Progress">
          <ul className="link-tiles">
            <li>
              <LinkTile
                to="/parent/stats"
                icon={<ProgressIcon />}
                title="Stats dashboard"
                description="XP, accuracy, streaks and mastery"
              />
            </li>
          </ul>
        </Card>
        <Card title="Family">
          <ul className="link-tiles">
            <li>
              <LinkTile
                to="/onboarding"
                icon={<UsersIcon />}
                title="Add or manage children"
                description="Profiles, subjects and device links"
              />
            </li>
            <li>
              <LinkTile
                to="/feedback/family"
                icon={<ChatIcon />}
                title="Family feedback"
                description="What your family has sent us"
              />
            </li>
            <li>
              <LinkTile
                to="/onboarding"
                icon={<DownloadIcon />}
                title="Download your family's data"
                description="Everything we hold, in one file"
              />
            </li>
          </ul>
        </Card>
        <ParentRewardNews />
        <ParentsPanel onDeleted={() => navigate('/', { replace: true })} />
        <FamilyLog />
        <Card title="Settings and policies">
          <ul className="link-tiles">
            <li>
              <LinkTile
                to="/settings"
                icon={<SettingsIcon />}
                title="App settings"
                description="Sound, reading and reminders"
              />
            </li>
            <li>
              <LinkTile
                to="/legal"
                icon={<ShieldIcon />}
                title="Policies"
                description="Privacy and terms in plain English"
              />
            </li>
            <li>
              <LinkTile
                to="/parent/help"
                icon={<HeartIcon />}
                title="Get help"
                description="Support for you and your child"
              />
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function ChildCard({ choices }: { choices: Child[] }) {
  // "Who's revising?" opens this page with ?student=<id> for the child the parent tapped.
  const [params] = useSearchParams();
  const asked = params.get('student');
  const [childId, setChildId] = useState(choices.find((c) => c.id === asked)?.id ?? choices[0]!.id);
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
        <ul className="link-tiles">
          <li>
            <LinkTile
              to={`/family/${id}/rewards`}
              icon={<CrownIcon />}
              title="Rewards you set"
              description="Treats for targets they reach"
            />
          </li>
          <li>
            <LinkTile
              to={`/parent/reminders/${id}`}
              icon={<BellIcon />}
              title="Reminder times"
              description="When reminders come, and quiet hours"
            />
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
      <LinkButton to="/parent" variant="quiet" icon={<BackIcon />}>
        Back to parent home
      </LinkButton>
    </div>
  );
}
