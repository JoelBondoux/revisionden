import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/Card';
import {
  BackIcon,
  BellIcon,
  ChatIcon,
  CrownIcon,
  DocumentIcon,
  DownloadIcon,
  HeartIcon,
  LearnIcon,
  ProgressIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
} from '../../components/icons';
import { ButtonTile, ButtonTiles, LinkButton } from '../../components/links';
import { LoadingOrError } from '../../api/LoadingOrError';
import { useApiResource } from '../../api/useApiResource';
import { ChildReminderSettings, ParentRewardNews } from '../notifications';
import { NotSetUp } from '../stats/Tile';
import { useStatsApi, type Child } from '../stats/statsApi';
import { FamilyLog, ParentsPanel, RemovalNotice } from '../parents';
import { LinkedDevicesCard } from '../onboarding/LinkedDevicesCard';
import { ThingsToCheckCard } from '../onboarding/checksUi';
import { BetaBadge } from '../programmes/BetaBadge';
import { InstallCard } from '../../pwa/InstallCard';
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
      <BetaBadge />
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
      <LinkedDevicesCard />
      <ThingsToCheckCard />
      <InstallCard />
      <div className="parent-home__grid">
        <Card title="Progress">
          <ButtonTiles>
            <ButtonTile to="/parent/stats" icon={<ProgressIcon />} label="Stats dashboard" />
          </ButtonTiles>
        </Card>
        <Card title="Family">
          <ButtonTiles>
            <ButtonTile to="/onboarding" icon={<UsersIcon />} label="Children" />
            <ButtonTile to="/feedback/family" icon={<ChatIcon />} label="Family feedback" />
            <ButtonTile to="/complaints" icon={<DocumentIcon />} label="Complaints" />
            <ButtonTile to="/onboarding" icon={<DownloadIcon />} label="Your data" />
          </ButtonTiles>
        </Card>
        <ParentRewardNews />
        <ParentsPanel onDeleted={() => navigate('/', { replace: true })} />
        <FamilyLog />
        <Card title="Settings and policies">
          <ButtonTiles>
            <ButtonTile to="/settings" icon={<SettingsIcon />} label="App settings" />
            <ButtonTile to="/legal" icon={<ShieldIcon />} label="Policies" />
            <ButtonTile to="/parent/help" icon={<HeartIcon />} label="Get help" tone="help" />
          </ButtonTiles>
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
        <ButtonTiles>
          <ButtonTile to={`/family/${id}/rewards`} icon={<CrownIcon />} label="Rewards you set" />
          <ButtonTile to={`/parent/reminders/${id}`} icon={<BellIcon />} label="Reminder times" />
          <ButtonTile to={`/parent/subjects/${id}`} icon={<LearnIcon />} label="Subjects" />
        </ButtonTiles>
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
