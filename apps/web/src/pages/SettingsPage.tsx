import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { useBugButton } from '../features/feedback/bugButtonContext';
import { DeviceReminders } from '../features/notifications';
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
        <ul className="link-list">
          <li>
            <Link to="/install">Add to Home Screen</Link>
          </li>
          <li>
            <Link to="/family">Switch profile</Link>
          </li>
          <li>
            <Link to="/rewards">My rewards</Link>
          </li>
        </ul>
      </Card>
      <Card title="Parents">
        <ul className="link-list">
          <li>
            <Link to="/parent">Parent home</Link>
          </li>
        </ul>
      </Card>
      <ReadingSettingsCard />
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
        <ul className="link-list">
          <li>
            <Link to="/help">Get help</Link>
          </li>
          <li>
            <Link to="/ask-a-parent">Ask a parent to raise something</Link>
          </li>
          <li>
            <Link to="/feedback" state={{ from: '/settings' }}>
              Send feedback or report a bug
            </Link>
          </li>
          <li>
            <Link to="/feedback/mine">Your feedback</Link>
          </li>
          <li>
            <Link to="/feedback/family">Your family&apos;s feedback (parents)</Link>
          </li>
          <li>
            <Link to="/legal">Policies</Link>
          </li>
          <li>
            <Link to="/about">About RevisionDen</Link>
          </li>
        </ul>
      </Card>
      <ParentCanSee />
    </div>
  );
}
