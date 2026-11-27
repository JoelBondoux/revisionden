import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { StudentProvider } from '../../session/StudentContext';
import { BugButton } from './BugButton';
import {
  BUG_BUTTON_KEY,
  BugButtonProvider,
  useBugButton,
  useHideBugButton,
} from './bugButtonContext';
import { FeedbackApiProvider, type FeedbackApi } from './feedbackApi';

function fakeApi(overrides: Partial<FeedbackApi> = {}): FeedbackApi {
  return {
    send: vi.fn(async () => {}),
    listOwn: vi.fn(async () => []),
    listFamily: vi.fn(async () => []),
    listAll: vi.fn(async () => []),
    setStatus: vi.fn(),
    confirm: vi.fn(),
    listRewards: vi.fn(async () => []),
    markRewardsSeen: vi.fn(async () => {}),
    bugButton: vi.fn(async () => ({ state: 'on' as const })),
    markNotABug: vi.fn(),
    childBugButton: vi.fn(async () => ({ state: 'on' as const })),
    switchChildBugButtonOn: vi.fn(async () => ({ state: 'on' as const })),
    errorReports: vi.fn(),
    ...overrides,
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

function Hider() {
  useHideBugButton(true);
  return <p>Test question</p>;
}

function Toggle() {
  const { shown, setShown } = useBugButton();
  return (
    <label>
      <input type="checkbox" checked={shown} onChange={(e) => setShown(e.target.checked)} />
      Show it
    </label>
  );
}

function show({
  api = fakeApi(),
  storage = memoryStorage() as Parameters<typeof BugButtonProvider>[0]['storage'],
  studentId = null as string | null,
  page = <p>A page</p>,
} = {}) {
  render(
    <StudentProvider storage={{ getItem: () => studentId, setItem: () => {} }}>
      <FeedbackApiProvider value={api}>
        <BugButtonProvider storage={storage}>
          <MemoryRouter initialEntries={['/cards']}>
            <Routes>
              <Route path="/cards" element={page} />
              <Route path="/feedback/family" element={<h1>Family list</h1>} />
              <Route path="/feedback/mine" element={<h1>My list</h1>} />
            </Routes>
            <BugButton />
          </MemoryRouter>
        </BugButtonProvider>
      </FeedbackApiProvider>
    </StudentProvider>,
  );
  return api;
}

describe('bug button', () => {
  it('sits on the screen with a plain name and its own drawn icon', () => {
    show();
    const button = screen.getByRole('button', { name: 'Report a bug' });
    expect(button.querySelector('svg')).not.toBeNull();
    expect(button.querySelector('img')).toBeNull();
  });

  it('opens the bug report straight away with the current screen filled in', async () => {
    const api = show();
    await userEvent.click(screen.getByRole('button', { name: 'Report a bug' }));
    const sheet = screen.getByRole('dialog', { name: 'Report a bug' });
    expect(within(sheet).getByRole('radio', { name: 'Bug' })).toBeChecked();
    expect(within(sheet).getByText('Screen: /cards')).toBeInTheDocument();
    expect(within(sheet).queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Send' }));
    expect(api.send).toHaveBeenCalledWith('parent', {
      kind: 'bug',
      device: expect.objectContaining({ route: '/cards' }),
    });
    expect(await within(sheet).findByRole('heading', { name: 'Thank you!' })).toBeInTheDocument();
  });

  it("keeps a student's device details off until they turn them on", async () => {
    const api = show({ studentId: 'student-1' });
    await userEvent.click(screen.getByRole('button', { name: 'Report a bug' }));
    const sheet = screen.getByRole('dialog', { name: 'Report a bug' });
    expect(
      within(sheet).getByRole('checkbox', { name: 'Include device details' }),
    ).not.toBeChecked();
    expect(within(sheet).getByText('Your parent can see what you send.')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Send' }));
    expect(api.send).toHaveBeenCalledWith('student', { kind: 'bug' });
  });

  it('closes the sheet when the reporter follows a link from it', async () => {
    show({ studentId: 'student-1' });
    await userEvent.click(screen.getByRole('button', { name: 'Report a bug' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await userEvent.click(await screen.findByRole('link', { name: 'See your feedback' }));
    expect(screen.getByRole('heading', { name: 'My list' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the sheet with its close button', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Report a bug' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('stays away when switched off on this device', () => {
    show({ storage: memoryStorage({ [BUG_BUTTON_KEY]: 'off' }) });
    expect(screen.queryByRole('button', { name: 'Report a bug' })).not.toBeInTheDocument();
  });

  it('remembers being switched off and back on', async () => {
    const storage = memoryStorage();
    show({ storage, page: <Toggle /> });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show it' }));
    expect(screen.queryByRole('button', { name: 'Report a bug' })).not.toBeInTheDocument();
    expect(storage.map.get(BUG_BUTTON_KEY)).toBe('off');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show it' }));
    expect(screen.getByRole('button', { name: 'Report a bug' })).toBeInTheDocument();
    expect(storage.map.get(BUG_BUTTON_KEY)).toBe('on');
  });

  it('still shows, and can be switched off for this visit, when storage is blocked', async () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    show({ storage: blocked, page: <Toggle /> });
    expect(screen.getByRole('button', { name: 'Report a bug' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show it' }));
    expect(screen.queryByRole('button', { name: 'Report a bug' })).not.toBeInTheDocument();
  });

  it('hides while a screen asks it to, even when several screens ask', async () => {
    function Screens() {
      const [first, setFirst] = useState(true);
      const [second, setSecond] = useState(true);
      return (
        <>
          {first && <Hider />}
          {second && <Hider />}
          <button onClick={() => setFirst(false)}>End first</button>
          <button onClick={() => setSecond(false)}>End second</button>
          <Link to="/feedback/mine">Away</Link>
        </>
      );
    }
    show({ page: <Screens /> });
    expect(screen.queryByRole('button', { name: 'Report a bug' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'End first' }));
    expect(screen.queryByRole('button', { name: 'Report a bug' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'End second' }));
    expect(screen.getByRole('button', { name: 'Report a bug' })).toBeInTheDocument();
  });

  it('does nothing outside its provider', () => {
    render(<Hider />);
    expect(screen.getByText('Test question')).toBeInTheDocument();
  });
});
