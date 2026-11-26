import { Card } from '../components/Card';
import {
  ChatIcon,
  CrownIcon,
  DocumentIcon,
  HeartIcon,
  HomeIcon,
  InfoIcon,
  ProgressIcon,
  ShieldIcon,
  UsersIcon,
} from '../components/icons';
import { LinkTile } from '../components/links';
import { useBugButton } from '../features/feedback/bugButtonContext';
import { DeviceReminders } from '../features/notifications';
import { AppearanceSettingsCard } from '../features/appearance';
import { EffectStyleCard } from '../features/juice/styles';
import { ReadingSettingsCard } from '../features/reading';
import { ReadAloudSettingsCard } from '../features/read-aloud';
import { SoundSettingsCard } from '../features/sound';
import { ParentCanSee } from '../features/stats/ParentCanSee';
import { MySubjectsCard } from '../features/onboarding/checksUi';
import { InstallButton } from '../pwa/InstallCard';

export function SettingsPage() {
  const bugButton = useBugButton();
  return (
    <div className="stack">
      <h1>Settings</h1>
      {/* Get help comes first on Settings, the one place students find it (owner, 2026-11-26).
          Tapping it only opens the private Get help page; nothing is recorded. */}
      <section className="settings-get-help" aria-label="Get help">
        <ul className="link-tiles">
          <li>
            <LinkTile
              to="/help"
              icon={<HeartIcon />}
              title="Get help"
              description="Private support if something is worrying you. Nobody is told you looked."
            />
          </li>
        </ul>
      </section>
      {/* Progress moved here from the main nav (owner, 2026-11-26); /progress is unchanged. */}
      <ul className="link-tiles">
        <li>
          <LinkTile
            to="/progress"
            icon={<ProgressIcon />}
            title="My progress"
            description="Your stats, mastery and personal bests"
          />
        </li>
      </ul>
      <Card title="This device">
        <ul className="link-tiles">
          <li>
            <InstallButton />
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
          <li>
            <LinkTile
              to="/league"
              icon={<UsersIcon />}
              title="Friends league"
              description="This week's league with your friends"
            />
          </li>
        </ul>
      </Card>
      <MySubjectsCard />
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
      <EffectStyleCard />
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
              to="/ask-a-parent"
              icon={<UsersIcon />}
              title="Ask a parent to raise something"
              description="If something feels wrong or unfair"
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
