import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { DeviceReminders } from '../features/notifications';
import { SoundSettingsCard } from '../features/sound';

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
          <li>
            <Link to="/rewards">My rewards</Link>
          </li>
        </ul>
      </Card>
      <SoundSettingsCard />
      <DeviceReminders />
    </div>
  );
}
