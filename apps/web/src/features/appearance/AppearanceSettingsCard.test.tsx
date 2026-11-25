import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppearanceProvider } from './AppearanceProvider';
import { AppearanceSettingsCard } from './AppearanceSettingsCard';
import { APPEARANCE_KEY } from './settings';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

/** A device dark-mode setting that tests can flip. */
function deviceTheme(dark: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  return {
    matchMedia: () => query,
    set(next: boolean) {
      query.matches = next;
      listeners.forEach((fn) => fn());
    },
  };
}

function setup(initial: Record<string, string> = {}, dark = false) {
  const storage = memoryStorage(initial);
  const device = deviceTheme(dark);
  const root = document.createElement('html');
  render(
    <AppearanceProvider storage={storage} root={root} matchMedia={device.matchMedia}>
      <AppearanceSettingsCard />
    </AppearanceProvider>,
  );
  return { storage, root, device };
}

describe('Appearance settings card', () => {
  it('offers theme, colours and the background pattern, with the defaults chosen', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /background pattern/i })).toBeChecked();
  });

  it('switches theme, colours and pattern at once and remembers them on this device', async () => {
    const { storage, root } = setup();
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Colour-blind friendly' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /background pattern/i }));
    expect(root.dataset).toMatchObject({ theme: 'dark', palette: 'colourblind', pattern: 'off' });
    expect(JSON.parse(storage.data.get(APPEARANCE_KEY) ?? '{}')).toEqual({
      theme: 'dark',
      palette: 'colourblind',
      pattern: 'off',
    });
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(root.dataset.theme).toBe('light');
  });

  it('follows the device on System, including when the device changes', () => {
    const { root, device } = setup({}, true);
    expect(root.dataset.theme).toBe('dark');
    act(() => device.set(false));
    expect(root.dataset.theme).toBe('light');
  });

  it('ignores device changes once a theme is chosen', async () => {
    const { root, device } = setup({ [APPEARANCE_KEY]: '{"theme":"light"}' }, false);
    act(() => device.set(true));
    expect(root.dataset.theme).toBe('light');
  });

  it('explains that colours never carry meaning alone', () => {
    setup();
    expect(screen.getByText(/blue.*orange/i)).toBeInTheDocument();
    expect(screen.getByText(/icons and words/i)).toBeInTheDocument();
  });
});
