import { useState, useSyncExternalStore } from 'react';
import { Button, LinkTile, Sheet } from '../components';
import { PhoneIcon } from '../components/icons';
import { Card } from '../components/Card';
import { Pip } from '../components/Pip';
import {
  dismissInstall,
  installDismissed,
  installState,
  iosDevice,
  isStandalone,
  type InstallStore,
  type IosDevice,
} from './install';
import { appInstallStore } from './installStore';
import { IosSteps } from './IosSteps';
import './install.css';

interface InstallEnv {
  standalone: boolean;
  ios: IosDevice | null;
}

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserInstallEnv(): InstallEnv {
  return { standalone: isStandalone(window), ios: iosDevice(window.navigator) };
}

function browserStorage(): KeyValueStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export interface InstallProps {
  /** Injected in tests; the app uses the one store and the real browser. */
  store?: InstallStore;
  env?: InstallEnv;
  storage?: KeyValueStorage;
  now?: () => Date;
}

function useInstall({ store = appInstallStore, env }: InstallProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get);
  const [device] = useState(() => env ?? browserInstallEnv());
  return {
    store,
    device,
    state: installState({ ...device, ...snapshot }),
  };
}

export const INSTALL_TITLE = 'Add RevisionDen to this device';

/**
 * A dismissible card (never a pop-up) on the topic map and the parent home: the browser's install
 * prompt, or Share → Add to Home Screen steps on an iPhone or iPad. Hidden where the browser
 * cannot install, once installed, and for 30 days after "Not now".
 */
export function InstallCard(props: InstallProps) {
  const { store, device, state } = useInstall(props);
  const storage = props.storage ?? browserStorage();
  const now = props.now ?? (() => new Date());
  const [hidden, setHidden] = useState(() => installDismissed(storage, now()));
  const [showSteps, setShowSteps] = useState(false);

  if (hidden || state === 'installed' || state === 'unsupported') return null;

  const notNow = () => {
    dismissInstall(storage, now());
    setHidden(true);
  };

  return (
    <Card className="install-card">
      <div className="install-card__body">
        <Pip size={72} mood="cheer" />
        <div className="install-card__text">
          <h2 className="card__title">{INSTALL_TITLE}</h2>
          <p className="secondary-text">
            Open RevisionDen from your Home Screen, full screen like an app, even when the Wi-Fi
            drops.
          </p>
        </div>
      </div>
      {state === 'prompt' ? (
        <Button block onClick={() => void store.install()}>
          {INSTALL_TITLE}
        </Button>
      ) : (
        <Button block aria-haspopup="dialog" onClick={() => setShowSteps(true)}>
          {INSTALL_TITLE}
        </Button>
      )}
      <Button variant="secondary" onClick={notNow}>
        Not now
      </Button>
      {device.ios && (
        <Sheet
          open={showSteps}
          title="Add RevisionDen to your Home Screen"
          onClose={() => setShowSteps(false)}
        >
          <IosSteps device={device.ios} />
        </Sheet>
      )}
    </Card>
  );
}

/** The Settings entry: the same install, as a button; "how to" steps where there is no prompt. */
export function InstallButton(props: InstallProps) {
  const { store, state } = useInstall(props);
  if (state === 'installed') {
    return <p className="secondary-text">RevisionDen is installed on this device.</p>;
  }
  if (state === 'prompt') {
    return (
      <Button variant="secondary" onClick={() => void store.install()}>
        {INSTALL_TITLE}
      </Button>
    );
  }
  return (
    <LinkTile
      to="/install"
      icon={<PhoneIcon />}
      title={INSTALL_TITLE}
      description="Open RevisionDen like an app"
    />
  );
}
