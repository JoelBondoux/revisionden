import { Card } from '../components/Card';
import {
  ChatIcon,
  CrownIcon,
  DocumentIcon,
  HeartIcon,
  HomeIcon,
  InfoIcon,
  PhoneIcon,
  ShieldIcon,
  UsersIcon,
} from '../components/icons';
import { LinkTile } from '../components/links';
import { useBugButton } from '../features/feedback/bugButtonContext';
import { DeviceReminders } from '../features/notifications';
import { AppearanceSettingsCard } from '../features/appearance';
import { ReadingSettingsCard } from '../features/reading';
import { ReadAloudSettingsCard } from '../features/read-aloud';
import { SoundSettingsCard } from '../features/sound';
import { ParentCanSee } from '../features/stats/ParentCanSee';

export function SettingsPage() {
  const bugButton = useBugButton();
  return (
    <div className="stack">
      <h1>Settings</h1>
      <Card title="This device">
        <ul className="link-tiles">
          <li>
            <LinkTile
              to="/install"
              icon={<PhoneIcon />}
              title="Add to Home Screen"
              description="Open RevisionDen like an app"
            />
          </li>
          <li>
            <LinkTile
              to="/family"
              icon={<UsersIcon />}
              title="Switch profile"
              description="Choose who is revising"
            />
          </li>
          <li>
            <LinkTile
              to="/rewards"
              icon={<CrownIcon />}
              title="My rewards"
              description="Your level, chapter and collections"
            />
          </li>
        </ul>
      </Card>
      <Card title="Parents">
        <ul className="link-tiles">
          <li>
            <LinkTile
              to="/parent"
              icon={<HomeIcon />}
              title="Parent home"
              description="Stats, rewards you set and reminders"
            />
          </li>
        </ul>
      </Card>
      <ReadingSettingsCard />
      <AppearanceSettingsCard />
      <ReadAloudSettingsCard />
      <SoundSettingsCard />
      <DeviceReminders />
      <Card title="Help and information">
        <label className="feedback__toggle">
          <input
            type="checkbox"
            checked={bugButton.shown}
            onChange={(e) => bugButton.setShown(e.target.checked)}
          />
          <span>Show the bug button</span>
        </label>
        <p className="secondary-text">
          The small bug in the corner opens a bug report. Saved on this device.
        </p>
        <ul className="link-tiles">
          <li>
            <LinkTile
              to="/help"
              icon={<HeartIcon />}
              title="Get help"
              description="People to talk to, any time"
            />
          </li>
          <li>
            <LinkTile
              to="/feedback"
              state={{ from: '/settings' }}
              icon={<ChatIcon />}
              title="Send feedback or report a bug"
              description="Tell us what to fix or add"
            />
          </li>
          <li>
            <LinkTile
              to="/feedback/mine"
              icon={<DocumentIcon />}
              title="Your feedback"
              description="What you sent and what happened"
            />
          </li>
          <li>
            <LinkTile
              to="/feedback/family"
              icon={<UsersIcon />}
              title="Your family's feedback (parents)"
              description="Everything your family sent"
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
              to="/about"
              icon={<InfoIcon />}
              title="About RevisionDen"
              description="Version and what's new"
            />
          </li>
        </ul>
      </Card>
      <ParentCanSee />
    </div>
  );
}
