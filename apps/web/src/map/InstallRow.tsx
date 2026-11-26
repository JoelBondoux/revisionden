import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Button, Sheet } from '../components';
import {
  dismissInstall,
  installDismissed,
  installState,
  iosDevice,
  isStandalone,
  type InstallStore,
  type IosDevice,
} from '../pwa/install';
import { INSTALL_TITLE } from '../pwa/InstallCard';
import { appInstallStore } from '../pwa/installStore';
import { IosSteps } from '../pwa/IosSteps';

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): KeyValueStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export interface InstallRowProps {
  /** Injected in tests; the app uses the one store, the real browser and local storage. */
  store?: InstallStore;
  env?: { standalone: boolean; ios: IosDevice | null };
  storage?: KeyValueStorage;
  now?: () => Date;
}

/**
 * "Add RevisionDen to this device" as one short row of the map's Today strip (J12b): the browser's
 * install prompt, or the iPhone and iPad steps in a sheet. Hidden where the browser cannot install,
 * once installed, and for 30 days after "Not now" (the same memory as the install card).
 */
export function InstallRow({ store = appInstallStore, env, storage, now }: InstallRowProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get);
  const [device] = useState(
    () => env ?? { standalone: isStandalone(window), ios: iosDevice(window.navigator) },
  );
  const [saved] = useState(() => storage ?? browserStorage());
  const today = now ?? (() => new Date());
  const [hidden, setHidden] = useState(() => installDismissed(saved, today()));
  const [showSteps, setShowSteps] = useState(false);
  const state = installState({ ...device, ...snapshot });

  if (hidden || state === 'installed' || state === 'unsupported') return null;

  return (
    <li className="today-strip__row today-strip__install">
      <p className="today-strip__what">
        <span className="today-strip__title">{INSTALL_TITLE}</span>
        <span className="today-strip__eyebrow">Open it like an app</span>
      </p>
      <span className="today-strip__actions">
        <Button
          variant="secondary"
          aria-label={INSTALL_TITLE}
          aria-haspopup={state === 'ios' ? 'dialog' : undefined}
          onClick={() => (state === 'prompt' ? void store.install() : setShowSteps(true))}
        >
          Add
        </Button>
        <button
          type="button"
          className="today-strip__not-now"
          onClick={() => {
            dismissInstall(saved, today());
            setHidden(true);
          }}
        >
          Not now
        </button>
      </span>
      {device.ios &&
        createPortal(
          <Sheet
            open={showSteps}
            title="Add RevisionDen to your Home Screen"
            onClose={() => setShowSteps(false)}
          >
            <IosSteps device={device.ios} />
          </Sheet>,
          document.body,
        )}
    </li>
  );
}
