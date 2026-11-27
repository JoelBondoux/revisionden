import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router-dom';
import { StudentProvider } from '../../session/StudentContext';
import { BugButton } from './BugButton';
import { BugButtonProvider } from './bugButtonContext';
import { BugButtonRestNote, ChildBugButtonNote } from './BugButtonRest';
import { FeedbackApiProvider, type BugButtonInfo, type FeedbackApi } from './feedbackApi';

function fakeApi(own: BugButtonInfo, child: BugButtonInfo = { state: 'on' }): FeedbackApi {
  return {
    send: vi.fn(async () => {}),
    listOwn: vi.fn(async () => []),
    listFamily: vi.fn(async () => []),
    listAll: vi.fn(async () => []),
    setStatus: vi.fn(),
    confirm: vi.fn(),
    listRewards: vi.fn(async () => []),
    markRewardsSeen: vi.fn(async () => {}),
    errorReports: vi.fn(),
    bugButton: vi.fn(async () => own),
    markNotABug: vi.fn(),
    childBugButton: vi.fn(async () => child),
    switchChildBugButtonOn: vi.fn(async () => ({ state: 'on' as const })),
  };
}

const storage = { getItem: () => null, setItem: () => {} };

function showStudent(api: FeedbackApi, studentId: string | null = 'student-1') {
  render(
    <StudentProvider storage={{ getItem: () => studentId, setItem: () => {} }}>
      <FeedbackApiProvider value={api}>
        <BugButtonProvider storage={storage}>
          <MemoryRouter>
            <BugButtonRestNote />
            <BugButton />
          </MemoryRouter>
        </BugButtonProvider>
      </FeedbackApiProvider>
    </StudentProvider>,
  );
}

/** Inside a router, as in AppLayout, with a link to move between student pages. */
function showStudentInRouter(api: FeedbackApi) {
  render(
    <StudentProvider storage={{ getItem: () => 'student-1', setItem: () => {} }}>
      <FeedbackApiProvider value={api}>
        <MemoryRouter>
          <BugButtonProvider storage={storage}>
            <Link to="/settings">Settings</Link>
            <BugButton />
          </BugButtonProvider>
        </MemoryRouter>
      </FeedbackApiProvider>
    </StudentProvider>,
  );
}

const hidden = () =>
  vi.waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Report a bug' })).not.toBeInTheDocument(),
  );

describe('bug button rest stays up to date while the app is open (L13)', () => {
  it('comes back without a reload when a parent switches it on and the app is focused again', async () => {
    const api = fakeApi({ state: 'removed' });
    showStudentInRouter(api);
    await hidden();

    vi.mocked(api.bugButton).mockResolvedValue({ state: 'on' });
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(await screen.findByRole('button', { name: 'Report a bug' })).toBeInTheDocument();
  });

  it('asks again when the student moves to another page', async () => {
    const user = userEvent.setup();
    const api = fakeApi({ state: 'removed' });
    showStudentInRouter(api);
    await hidden();
    vi.mocked(api.bugButton).mockResolvedValue({ state: 'on' });
    await user.click(screen.getByRole('link', { name: 'Settings' }));
    expect(await screen.findByRole('button', { name: 'Report a bug' })).toBeInTheDocument();
  });

  it('asks again when the page becomes visible', async () => {
    const api = fakeApi({ state: 'removed' });
    showStudentInRouter(api);
    await hidden();
    vi.mocked(api.bugButton).mockResolvedValue({ state: 'on' });
    fireEvent(document, new Event('visibilitychange'));
    expect(await screen.findByRole('button', { name: 'Report a bug' })).toBeInTheDocument();
  });

  it('ends a rest on time, with no reload', async () => {
    const until = new Date(Date.now() + 200).toISOString();
    const api = fakeApi({ state: 'paused', until });
    showStudentInRouter(api);
    await hidden();
    vi.mocked(api.bugButton).mockResolvedValue({ state: 'on' });
    expect(
      await screen.findByRole('button', { name: 'Report a bug' }, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});

describe('bug button rest on the student device (L13)', () => {
  it('shows the bug button when it is on, and no note', async () => {
    const api = fakeApi({ state: 'on' });
    showStudent(api);
    expect(await screen.findByRole('button', { name: 'Report a bug' })).toBeInTheDocument();
    expect(api.bugButton).toHaveBeenCalled();
    expect(screen.queryByText(/taking a rest/)).not.toBeInTheDocument();
  });

  it('hides the bug button while it rests and says kindly until when', async () => {
    showStudent(fakeApi({ state: 'paused', until: '2026-12-08T10:00:00.000Z' }));
    expect(
      await screen.findByText(
        'The bug button is taking a rest until Tuesday 8 December. Thanks for helping make RevisionDen better!',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Report a bug' })).not.toBeInTheDocument();
  });

  it('hides it when removed and says a parent can switch it back on', async () => {
    showStudent(fakeApi({ state: 'removed' }));
    expect(
      await screen.findByText(
        'The bug button is switched off for now. A parent can switch it back on. Thanks for helping make RevisionDen better!',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Report a bug' })).not.toBeInTheDocument();
  });

  it('never asks the server on a parent device', async () => {
    const api = fakeApi({ state: 'removed' });
    showStudent(api, null);
    expect(await screen.findByRole('button', { name: 'Report a bug' })).toBeInTheDocument();
    expect(api.bugButton).not.toHaveBeenCalled();
  });
});

describe("a child's bug button in the parent area (L13)", () => {
  function showParent(api: FeedbackApi) {
    render(
      <FeedbackApiProvider value={api}>
        <ChildBugButtonNote studentId="student-1" nickname="test_kid" />
      </FeedbackApiProvider>,
    );
  }

  it('says nothing when the button is on', async () => {
    const api = fakeApi({ state: 'on' }, { state: 'on' });
    showParent(api);
    await vi.waitFor(() => expect(api.childBugButton).toHaveBeenCalledWith('student-1'));
    expect(screen.queryByRole('button', { name: /switch.*back on/i })).not.toBeInTheDocument();
  });

  it('tells the parent the button is resting and lets them switch it back on', async () => {
    const api = fakeApi({ state: 'on' }, { state: 'paused', until: '2026-12-08T10:00:00.000Z' });
    showParent(api);
    expect(
      await screen.findByText(
        "test_kid's bug button is taking a rest until Tuesday 8 December, because several of their reports were not bugs.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: "Switch test_kid's bug button back on" }),
    );
    expect(api.switchChildBugButtonOn).toHaveBeenCalledWith('student-1');
    expect(await screen.findByText("test_kid's bug button is back on.")).toBeInTheDocument();
  });

  it('tells the parent when the button has been removed', async () => {
    showParent(fakeApi({ state: 'on' }, { state: 'removed' }));
    expect(
      await screen.findByText(
        "test_kid's bug button is switched off, because many of their reports were not bugs.",
      ),
    ).toBeInTheDocument();
  });
});
