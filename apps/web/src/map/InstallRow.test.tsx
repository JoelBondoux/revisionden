import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { createInstallStore, type InstallPromptEvent } from '../pwa/install';
import { InstallRow } from './InstallRow';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-26T10:00:00Z');

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

/** A browser with an install prompt waiting (Chrome, Edge, Android). */
function chrome() {
  const target = new EventTarget();
  const store = createInstallStore(target);
  const event = new Event('beforeinstallprompt') as InstallPromptEvent;
  Object.assign(event, {
    prompt: vi.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
  });
  target.dispatchEvent(event);
  return { store, event, env: { standalone: false, ios: null } };
}

function show(props: Parameters<typeof InstallRow>[0]) {
  const storage = props.storage ?? memoryStorage();
  const view = render(
    <MemoryRouter>
      <ul>
        <InstallRow now={() => NOW} storage={storage} {...props} />
      </ul>
    </MemoryRouter>,
  );
  return { storage, ...view };
}

const add = () => screen.queryByRole('button', { name: 'Add RevisionDen to this device' });

describe('The install row in the Today strip', () => {
  it('is one short row that opens the browser’s install prompt, then goes away', async () => {
    const { store, event, env } = chrome();
    show({ store, env });
    expect(screen.getByRole('listitem')).toHaveTextContent('Add RevisionDen to this device');
    await userEvent.click(add()!);
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(add()).not.toBeInTheDocument();
  });

  it('walks an iPhone through Share → Add to Home Screen in a sheet', async () => {
    const store = createInstallStore(new EventTarget());
    show({ store, env: { standalone: false, ios: 'iphone' } });
    await userEvent.click(add()!);
    const sheet = screen.getByRole('dialog', { name: 'Add RevisionDen to your Home Screen' });
    expect(within(sheet).getByRole('list', { name: 'Steps for iPhone' })).toBeInTheDocument();
  });

  it('is not shown where the browser cannot install, or once installed', () => {
    const none = createInstallStore(new EventTarget());
    const { unmount } = show({ store: none, env: { standalone: false, ios: null } });
    expect(add()).not.toBeInTheDocument();
    unmount();
    const { store } = chrome();
    show({ store, env: { standalone: true, ios: null } });
    expect(add()).not.toBeInTheDocument();
  });

  it('hides for 30 days after "Not now", shared with the install card', async () => {
    const { store, env } = chrome();
    const { storage, unmount } = show({ store, env });
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(add()).not.toBeInTheDocument();
    expect(storage.getItem('revisionden.installDismissed')).toBe(NOW.toISOString());
    unmount();
    show({ store, env, storage, now: () => new Date(NOW.getTime() + 31 * DAY) });
    expect(add()).toBeInTheDocument();
  });
});
