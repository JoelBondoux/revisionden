import { Card } from '../components/Card';
import {
  BackIcon,
  ChatIcon,
  CrownIcon,
  DocumentIcon,
  HeartIcon,
  HomeIcon,
  InfoIcon,
  ProgressIcon,
  SettingsIcon,
  ShieldIcon,
  StarIcon,
  UsersIcon,
} from '../components/icons';
import { LinkButton, LinkTile } from '../components/links';
import { useBugButton } from '../features/feedback/bugButtonContext';
import { DeviceReminders } from '../features/notifications';
import { AppearanceSettingsCard } from '../features/appearance';
import { EffectStyleCard } from '../features/juice/styles';
import { MeHeader, useMyAvatar } from '../features/me';
import { ReadingSettingsCard } from '../features/reading';
import { ReadAloudSettingsCard } from '../features/read-aloud';
import { SoundSettingsCard } from '../features/sound';
import { ParentCanSee } from '../features/stats/ParentCanSee';
import { MySubjectsCard } from '../features/onboarding/checksUi';
import { InstallButton } from '../pwa/InstallCard';

/**
 * Me (/settings, W9): short enough for one phone screen. The avatar and nickname come first,
 * then Get help (owner, 2026-11-26: always the first link), My progress and My rewards, then two
 * sub-pages: Look and sound, and More for everything else.
 */
export function SettingsPage() {
  const student = useMyAvatar();
  return (
    <div className="stack">
      <h1>Me</h1>
      <MeHeader />
      {/* Tapping Get help only opens the private Get help page; nothing is recorded. */}
      <ul className="link-tiles">
        <li>
          <LinkTile
            to="/help"
            icon={<HeartIcon />}
            title="Get help"
            description="Private support if something is worrying you. Nobody is told you looked."
          />
        </li>
        <li>
          <LinkTile
            to="/progress"
            icon={<ProgressIcon />}
            title="My progress"
            description="Your stats, mastery and personal bests"
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
        {/* A parent on this page (no student on the device) gets their way home straight away. */}
        {!student && (
          <li>
            <ParentHomeTile />
          </li>
        )}
        <li>
          <LinkTile
            to="/settings/look-and-sound"
            icon={<StarIcon />}
            title="Look and sound"
            description="Effect style, theme, sound, reading comfort and read aloud"
          />
        </li>
        <li>
          <LinkTile
            to="/settings/more"
            icon={<SettingsIcon />}
            title="More"
            description="Subjects, reminders, profiles, parents, feedback, policies and about"
          />
        </li>
      </ul>
    </div>
  );
}

function ParentHomeTile() {
  return (
    <LinkTile
      to="/parent"
      icon={<HomeIcon />}
      title="Parent home"
      description="Stats, rewards you set and reminders"
    />
  );
}

function BackToMe() {
  return (
    <LinkButton to="/settings" variant="quiet" icon={<BackIcon />}>
      Back to Me
    </LinkButton>
  );
}

/** Look and sound (/settings/look-and-sound, W9): every setting for how the app looks and sounds. */
export function LookAndSoundPage() {
  return (
    <div className="stack">
      <h1>Look and sound</h1>
      <ReadingSettingsCard />
      <AppearanceSettingsCard />
      <EffectStyleCard />
      <ReadAloudSettingsCard />
      <SoundSettingsCard />
      <BackToMe />
    </div>
  );
}

/** More (/settings/more, W9): everything else that used to be on Settings. */
export function MoreSettingsPage() {
  const bugButton = useBugButton();
  return (
    <div className="stack">
      <h1>More</h1>
      <MySubjectsCard />
      <DeviceReminders />
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
        </ul>
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
      </Card>
      <Card title="Parents">
        <ul className="link-tiles">
          <li>
            <ParentHomeTile />
          </li>
          <li>
            <LinkTile
              to="/ask-a-parent"
              icon={<UsersIcon />}
              title="Ask a parent to raise something"
              description="If something feels wrong or unfair"
            />
          </li>
        </ul>
      </Card>
      <Card title="Feedback">
        <ul className="link-tiles">
          <li>
            <LinkTile
              to="/feedback"
              state={{ from: '/settings/more' }}
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
        </ul>
      </Card>
      <Card title="Policies and about">
        <ul className="link-tiles">
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
      <BackToMe />
    </div>
  );
}
