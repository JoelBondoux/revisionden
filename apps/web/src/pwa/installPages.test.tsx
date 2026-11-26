import { screen, within } from '@testing-library/react';
import { renderRoute } from '../test/render';
import type { InstallPromptEvent } from './install';

/** Chrome, Edge or Android: the browser offers an install prompt as the app loads. */
function browserOffersInstall() {
  const event = new Event('beforeinstallprompt') as InstallPromptEvent;
  Object.assign(event, {
    prompt: vi.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
  });
  window.dispatchEvent(event);
}

function pretendToBe(userAgent: string, platform = '') {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue(platform);
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('where "Add RevisionDen to this device" appears', () => {
  it('on the child’s Home (moved from the topic map, J15b)', async () => {
    browserOffersInstall();
    renderRoute('/home');
    expect(
      await screen.findByRole('button', { name: 'Add RevisionDen to this device' }),
    ).toBeInTheDocument();
  });

  it('on the parent home', async () => {
    browserOffersInstall();
    renderRoute('/parent', { studentId: null });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Parent home' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Add RevisionDen to this device' }),
    ).toBeInTheDocument();
  });

  it('in Settings, as a button rather than a text link', async () => {
    browserOffersInstall();
    renderRoute('/settings');
    const entry = await screen.findByRole('button', { name: 'Add RevisionDen to this device' });
    expect(entry).toHaveClass('btn');
  });
});

describe('the /install help page', () => {
  it('shows the iPhone steps on an iPhone', async () => {
    pretendToBe('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone');
    renderRoute('/install');
    const steps = await screen.findByRole('list', { name: 'Steps for iPhone' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('list', { name: 'Steps for iPad' })).not.toBeInTheDocument();
  });

  it('shows the iPad steps on an iPad, which says it is a Mac', async () => {
    pretendToBe('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel');
    Object.defineProperty(window.navigator, 'maxTouchPoints', { value: 5, configurable: true });
    try {
      renderRoute('/install');
      expect(await screen.findByRole('list', { name: 'Steps for iPad' })).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Steps for iPhone' })).not.toBeInTheDocument();
    } finally {
      Reflect.deleteProperty(window.navigator, 'maxTouchPoints');
    }
  });

  it('shows both, and the Chrome and Edge way, on other devices', async () => {
    renderRoute('/install');
    expect(await screen.findByRole('list', { name: 'Steps for iPhone' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Steps for iPad' })).toBeInTheDocument();
    expect(screen.getByText(/install app/i, { selector: 'strong' })).toBeInTheDocument();
  });
});
