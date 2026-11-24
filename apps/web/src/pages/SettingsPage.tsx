import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { DeviceReminders } from '../features/notifications';

export function SettingsPage() {
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
        </ul>
      </Card>
      <DeviceReminders />
      <Card title="Help and information">
        <ul className="link-list">
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
    </div>
  );
}
