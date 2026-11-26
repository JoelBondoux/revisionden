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
import { ButtonTile, ButtonTiles, LinkButton } from '../components/links';
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
      {/* Tapping Get help only opens the private Get help page; nothing is recorded. Short
          labels, no helper sentences (owner, 2026-11-26, J15a). */}
      <ButtonTiles label="Me">
        <ButtonTile to="/help" icon={<HeartIcon />} label="Get help" tone="help" />
        <ButtonTile to="/progress" icon={<ProgressIcon />} label="My progress" />
        <ButtonTile to="/rewards" icon={<CrownIcon />} label="My rewards" />
        {/* A parent on this page (no student on the device) gets their way home straight away. */}
        {!student && <ParentHomeTile />}
        <ButtonTile to="/settings/look-and-sound" icon={<StarIcon />} label="Look and sound" />
        <ButtonTile to="/settings/more" icon={<SettingsIcon />} label="More" />
      </ButtonTiles>
    </div>
  );
}

function ParentHomeTile() {
  return <ButtonTile to="/parent" icon={<HomeIcon />} label="Parent home" />;
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
        </ul>
        <ButtonTiles>
          <ButtonTile to="/family" icon={<UsersIcon />} label="Switch profile" />
        </ButtonTiles>
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
        <ButtonTiles>
          <ParentHomeTile />
          <ButtonTile to="/ask-a-parent" icon={<UsersIcon />} label="Ask a parent" />
        </ButtonTiles>
      </Card>
      <Card title="Feedback">
        <ButtonTiles>
          <ButtonTile
            to="/feedback"
            state={{ from: '/settings/more' }}
            icon={<ChatIcon />}
            label="Send feedback"
          />
          <ButtonTile to="/feedback/mine" icon={<DocumentIcon />} label="My feedback" />
          <ButtonTile to="/feedback/family" icon={<UsersIcon />} label="Family feedback" />
        </ButtonTiles>
      </Card>
      <Card title="Policies and about">
        <ButtonTiles>
          <ButtonTile to="/legal" icon={<ShieldIcon />} label="Policies" />
          <ButtonTile to="/about" icon={<InfoIcon />} label="About" />
        </ButtonTiles>
      </Card>
      <ParentCanSee />
      <BackToMe />
    </div>
  );
}
