import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { createInstallStore, type InstallPromptEvent } from './install';
import { InstallButton, InstallCard, type InstallProps } from './InstallCard';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-25T10:00:00Z');

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

function promptEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt') as InstallPromptEvent;
  Object.assign(event, {
    prompt: vi.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  });
  return event;
}

/** A browser with an install prompt waiting (Chrome, Edge, Android). */
function chrome() {
  const target = new EventTarget();
  const store = createInstallStore(target);
  const event = promptEvent();
  target.dispatchEvent(event);
  return { target, store, event, env: { standalone: false, ios: null } };
}

function show(ui: (p: InstallProps) => JSX.Element, props: InstallProps) {
  const storage = props.storage ?? memoryStorage();
  render(<MemoryRouter>{ui({ now: () => NOW, storage, ...props })}</MemoryRouter>);
  return storage;
}

const button = () => screen.queryByRole('button', { name: 'Add RevisionDen to this device' });

describe('"Add RevisionDen to this device" card', () => {
  it('shows Pip and opens the browser’s own install prompt on tap, then goes away', async () => {
    const { store, event, env } = chrome();
    show((p) => <InstallCard {...p} />, { store, env });
    expect(
      screen.getByRole('heading', { name: 'Add RevisionDen to this device' }),
    ).toBeInTheDocument();
    expect(document.querySelector('.install-card .pip')).not.toBeNull();
    await userEvent.click(button()!);
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('heading', { name: 'Add RevisionDen to this device' }),
    ).not.toBeInTheDocument();
  });

  it('walks an iPhone through Share → Add to Home Screen in a sheet', async () => {
    const store = createInstallStore(new EventTarget());
    show((p) => <InstallCard {...p} />, { store, env: { standalone: false, ios: 'iphone' } });
    await userEvent.click(button()!);
    const sheet = screen.getByRole('dialog', { name: 'Add RevisionDen to your Home Screen' });
    const steps = within(
      within(sheet).getByRole('list', { name: 'Steps for iPhone' }),
    ).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent(/share/i);
    expect(steps[0]).toHaveTextContent(/bottom of safari/i);
    expect(steps[1]).toHaveTextContent('Add to Home Screen');
    // Outside the card: the card's pop-in transform would otherwise trap the fixed sheet in it.
    expect(sheet.closest('.install-card')).toBeNull();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('tells an iPad where its Share button is', async () => {
    const store = createInstallStore(new EventTarget());
    show((p) => <InstallCard {...p} />, { store, env: { standalone: false, ios: 'ipad' } });
    await userEvent.click(button()!);
    expect(screen.getByRole('list', { name: 'Steps for iPad' })).toHaveTextContent(
      /next to the address bar/i,
    );
  });

  it('is not shown where the browser cannot install apps (Firefox on a computer)', () => {
    const store = createInstallStore(new EventTarget());
    show((p) => <InstallCard {...p} />, { store, env: { standalone: false, ios: null } });
    expect(button()).not.toBeInTheDocument();
  });

  it('is not shown once RevisionDen is installed or opened from the Home Screen', () => {
    const { store, target } = chrome();
    show((p) => <InstallCard {...p} />, { store, env: { standalone: true, ios: null } });
    expect(button()).not.toBeInTheDocument();
    const other = createInstallStore(target);
    target.dispatchEvent(new Event('appinstalled'));
    show((p) => <InstallCard {...p} />, {
      store: other,
      env: { standalone: false, ios: 'iphone' },
    });
    expect(button()).not.toBeInTheDocument();
  });

  it('hides for 30 days on this device after "Not now"', async () => {
    const { store, env } = chrome();
    const storage = show((p) => <InstallCard {...p} />, { store, env });
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(button()).not.toBeInTheDocument();
    expect(storage.getItem('revisionden.installDismissed')).toBe(NOW.toISOString());
    show((p) => <InstallCard {...p} />, {
      store,
      env,
      storage,
      now: () => new Date(NOW.getTime() + 29 * DAY),
    });
    expect(button()).not.toBeInTheDocument();
    show((p) => <InstallCard {...p} />, {
      store,
      env,
      storage,
      now: () => new Date(NOW.getTime() + 31 * DAY),
    });
    expect(button()).toBeInTheDocument();
  });

  it('is a card in the page, never a pop-up', () => {
    const { store, env } = chrome();
    show((p) => <InstallCard {...p} />, { store, env });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('Settings install button', () => {
  it('opens the install prompt where the browser has one', async () => {
    const { store, event, env } = chrome();
    show((p) => <InstallButton {...p} />, { store, env });
    await userEvent.click(button()!);
    expect(event.prompt).toHaveBeenCalled();
  });

  it('goes to the step-by-step help everywhere else', () => {
    const store = createInstallStore(new EventTarget());
    show((p) => <InstallButton {...p} />, { store, env: { standalone: false, ios: null } });
    const link = screen.getByRole('link', { name: 'Add RevisionDen to this device' });
    expect(link).toHaveAttribute('href', '/install');
  });

  it('says so when RevisionDen is already installed', () => {
    const store = createInstallStore(new EventTarget());
    show((p) => <InstallButton {...p} />, { store, env: { standalone: true, ios: null } });
    expect(screen.getByText('RevisionDen is installed on this device.')).toBeInTheDocument();
  });
});
