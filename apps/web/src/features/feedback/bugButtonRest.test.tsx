import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
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
