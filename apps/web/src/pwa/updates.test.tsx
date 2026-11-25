import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { checkForNewBuild, reportPossiblyStale, UpdateBanner } from './updates';

const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
};

describe('checkForNewBuild', () => {
  it('asks the server for the deployed build, skipping every cache', async () => {
    const fetch = vi.fn(async () => Response.json({ build: 'b2' }));
    expect(await checkForNewBuild('b1', fetch)).toBe('b2');
    expect(fetch).toHaveBeenCalledWith('/version.json', { cache: 'no-store' });
  });

  it('says nothing is new when the build is the same, unknown or cannot be read', async () => {
    expect(await checkForNewBuild('b1', async () => Response.json({ build: 'b1' }))).toBeNull();
    expect(await checkForNewBuild('b1', async () => new Response('<html>'))).toBeNull();
    expect(
      await checkForNewBuild('b1', async () => Promise.reject(new TypeError('offline'))),
    ).toBeNull();
  });
});

describe('UpdateBanner', () => {
  it('offers a refresh when a new version has been deployed', async () => {
    const reload = vi.fn();
    render(<UpdateBanner check={async () => 'b2'} reload={reload} storage={memoryStorage()} />);
    expect(await screen.findByText('A new version of RevisionDen is ready.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows nothing while the app is up to date', async () => {
    const check = vi.fn(async () => null);
    render(<UpdateBanner check={check} reload={vi.fn()} storage={memoryStorage()} />);
    await waitFor(() => expect(check).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
  });

  it('checks again when the app comes back to the foreground', async () => {
    const check = vi.fn(async () => null);
    render(<UpdateBanner check={check} reload={vi.fn()} storage={memoryStorage()} />);
    await waitFor(() => expect(check).toHaveBeenCalledTimes(1));
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(check).toHaveBeenCalledTimes(2));
  });

  it('reloads by itself, once, when an API call suggests this build is out of date', async () => {
    let deployed: string | null = null;
    const reload = vi.fn();
    const storage = memoryStorage();
    render(<UpdateBanner check={async () => deployed} reload={reload} storage={storage} />);
    await act(async () => reportPossiblyStale());
    expect(reload).not.toHaveBeenCalled();
    deployed = 'b2';
    await act(async () => reportPossiblyStale());
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    // Never a reload loop: the same build does not trigger another automatic reload.
    await act(async () => reportPossiblyStale());
    expect(reload).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });
});
