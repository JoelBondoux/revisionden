import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  FeedbackApiError,
  FeedbackApiProvider,
  type FeedbackApi,
  type TriageFeedback,
} from './feedbackApi';
import { AdminFeedbackPage, FeedbackListPage, snippet } from './lists';

const base = {
  createdAt: '2026-11-24T10:00:00.000Z',
  updatedAt: '2026-11-25T10:00:00.000Z',
};
const items: TriageFeedback[] = [
  {
    ...base,
    id: 'f1',
    kind: 'bug',
    text: 'Button does nothing',
    status: 'looking_into_it',
    senderRole: 'student',
    studentNickname: 'demo_kid',
    device: { appVersion: '00.01.002', route: '/cards' },
    outcome: null,
    rewardXp: 0,
    duplicateOf: null,
  },
  {
    ...base,
    id: 'f2',
    kind: 'idea',
    text: null,
    status: 'will_not_fix',
    senderRole: 'parent',
    studentNickname: null,
    device: null,
    outcome: null,
    rewardXp: 0,
    duplicateOf: null,
  },
];

const bug = (id: string, day: number, more: Partial<TriageFeedback> = {}): TriageFeedback => ({
  ...items[0]!,
  id,
  text: `Demo bug ${id}: the timer did not start when the page opened`,
  device: null,
  createdAt: `2026-11-${day}T10:00:00.000Z`,
  ...more,
});
const bugs: TriageFeedback[] = [
  bug('b1', 20, { outcome: 'confirmed', rewardXp: 50 }),
  bug('b2', 21, { outcome: 'duplicate', rewardXp: 20, duplicateOf: 'b1' }),
  bug('b3', 22),
  bug('b4', 23, { kind: 'idea', text: 'Demo idea' }),
];

function fakeApi(overrides: Partial<FeedbackApi> = {}): FeedbackApi {
  return {
    send: vi.fn(),
    listOwn: vi.fn(async () => [items[0]!]),
    listFamily: vi.fn(async () => items),
    listAll: vi.fn(async () => items),
    setStatus: vi.fn(async (id, status) => ({ ...items.find((i) => i.id === id)!, status })),
    confirm: vi.fn(async (id: string, duplicateOf?: string) => ({
      item: {
        ...bugs.find((i) => i.id === id)!,
        outcome: duplicateOf ? ('duplicate' as const) : ('confirmed' as const),
        rewardXp: duplicateOf ? 20 : 50,
        duplicateOf: duplicateOf ?? null,
      },
      message: duplicateOf ? 'Confirmed as a duplicate. +20 XP' : 'Confirmed. +50 XP',
    })),
    listRewards: vi.fn(async () => []),
    markRewardsSeen: vi.fn(async () => {}),
    errorReports: vi.fn(async () => ({
      since: '2026-11-24T08:00:00.000Z',
      total: 2,
      groups: [
        {
          screen: '/map',
          apiPath: '/v1/student/map',
          status: 404,
          count: 2,
          refs: ['RD-VDMW5E', 'RD-7K2M9Q'],
          builds: ['00.01.002-48657ff'],
          firstSeen: '2026-11-25T07:50:00.000Z',
          lastSeen: '2026-11-25T08:00:00.000Z',
        },
      ],
    })),
    ...overrides,
  };
}

const show = (api: FeedbackApi, ui: React.ReactNode) =>
  render(
    <FeedbackApiProvider value={api}>
      <MemoryRouter>{ui}</MemoryRouter>
    </FeedbackApiProvider>,
  );

describe("family's feedback", () => {
  it('lists each message with who sent it and a plain status', async () => {
    show(fakeApi(), <FeedbackListPage scope="family" />);
    expect(screen.getByRole('heading', { name: "Your family's feedback" })).toBeInTheDocument();
    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('Looking into it')).toBeInTheDocument();
    expect(within(rows[0]!).getByText(/From demo_kid/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Won't fix")).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/From you/)).toBeInTheDocument();
    expect(within(rows[1]!).getByText('No message')).toBeInTheDocument();
  });

  it("shows a student's own feedback", async () => {
    const api = fakeApi();
    show(api, <FeedbackListPage scope="mine" />);
    expect(screen.getByRole('heading', { name: 'Your feedback' })).toBeInTheDocument();
    expect(await screen.findAllByRole('listitem')).toHaveLength(1);
    expect(api.listOwn).toHaveBeenCalled();
  });

  it('says so when there is nothing yet', async () => {
    show(fakeApi({ listFamily: vi.fn(async () => []) }), <FeedbackListPage scope="family" />);
    expect(await screen.findByText('No feedback yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Send feedback' })).toHaveAttribute(
      'href',
      '/feedback',
    );
  });

  it('shows an error with a retry', async () => {
    const listFamily = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue([]);
    show(fakeApi({ listFamily }), <FeedbackListPage scope="family" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No feedback yet.')).toBeInTheDocument();
  });
});

describe('confirmed bugs in the family and student lists', () => {
  it.each(['family', 'mine'] as const)('thanks the sender in the %s list', async (scope) => {
    show(
      fakeApi({ listFamily: vi.fn(async () => bugs), listOwn: vi.fn(async () => bugs) }),
      <FeedbackListPage scope={scope} />,
    );
    const rows = await screen.findAllByRole('listitem');
    expect(within(rows[0]!).getByText('Confirmed – thank you!')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Confirmed – thank you!')).toBeInTheDocument();
    expect(within(rows[2]!).queryByText(/thank you/)).not.toBeInTheDocument();
  });
});

describe('operator triage of bugs', () => {
  const showBugs = (overrides: Partial<FeedbackApi> = {}) => {
    const api = fakeApi({ listAll: vi.fn(async () => bugs), ...overrides });
    show(api, <AdminFeedbackPage />);
    return api;
  };

  it('shows the outcome and reward of confirmed bugs, with nothing left to confirm', async () => {
    showBugs();
    const rows = await screen.findAllByRole('listitem');
    expect(within(rows[0]!).getByText('Confirmed')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('+50 XP')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Duplicate')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('+20 XP')).toBeInTheDocument();
    expect(within(rows[0]!).queryByRole('button', { name: 'Confirm bug' })).not.toBeInTheDocument();
    expect(within(rows[3]!).queryByRole('button', { name: 'Confirm bug' })).not.toBeInTheDocument();
  });

  it('confirms a new bug and shows what the API says', async () => {
    const api = showBugs();
    const row = (await screen.findAllByRole('listitem'))[2]!;
    await userEvent.click(within(row).getByRole('button', { name: 'Confirm bug' }));
    expect(api.confirm).toHaveBeenCalledWith('b3');
    expect(await within(row).findByRole('status')).toHaveTextContent('Confirmed. +50 XP');
    expect(within(row).getByText('Confirmed')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Confirm bug' })).not.toBeInTheDocument();
  });

  it('offers only earlier confirmed reports as the original of a duplicate', async () => {
    const api = showBugs();
    const row = (await screen.findAllByRole('listitem'))[2]!;
    const select = within(row).getByRole('combobox', { name: 'Duplicate of…' });
    const options = within(select).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Choose a confirmed report',
      'Bug: Demo bug b1: the timer did not start… (20 Nov 2026)',
    ]);
    const confirmDuplicate = within(row).getByRole('button', { name: 'Confirm as duplicate' });
    expect(confirmDuplicate).toBeDisabled();
    await userEvent.selectOptions(select, 'b1');
    await userEvent.click(confirmDuplicate);
    expect(api.confirm).toHaveBeenCalledWith('b3', 'b1');
    expect(await within(row).findByRole('status')).toHaveTextContent('Confirmed as a duplicate.');
    expect(within(row).getByText('Duplicate')).toBeInTheDocument();
  });

  it('says why a confirmation was refused', async () => {
    showBugs({
      confirm: vi.fn(async () =>
        Promise.reject(
          new FeedbackApiError(409, 'already_confirmed', 'This bug is already confirmed.'),
        ),
      ),
    });
    const row = (await screen.findAllByRole('listitem'))[2]!;
    await userEvent.click(within(row).getByRole('button', { name: 'Confirm bug' }));
    expect(await within(row).findByRole('alert')).toHaveTextContent(
      'This bug is already confirmed.',
    );
  });

  it('gives a general message when confirming fails another way', async () => {
    showBugs({ confirm: vi.fn(async () => Promise.reject(new Error('down'))) });
    const row = (await screen.findAllByRole('listitem'))[2]!;
    await userEvent.click(within(row).getByRole('button', { name: 'Confirm bug' }));
    expect(await within(row).findByRole('alert')).toHaveTextContent('Could not confirm');
  });

  it('lets a later bug be a duplicate of one confirmed just now', async () => {
    const later = bug('b5', 24);
    show(fakeApi({ listAll: vi.fn(async () => [bug('b3', 22), later]) }), <AdminFeedbackPage />);
    const rows = await screen.findAllByRole('listitem');
    const select = within(rows[1]!).getByRole('combobox', { name: 'Duplicate of…' });
    expect(within(select).getAllByRole('option')).toHaveLength(1);
    await userEvent.click(within(rows[0]!).getByRole('button', { name: 'Confirm bug' }));
    await within(rows[0]!).findByRole('status');
    expect(within(select).getAllByRole('option')).toHaveLength(2);
  });
});

describe('operator triage', () => {
  it('lists every message with its device details and changes a status', async () => {
    const api = fakeApi();
    show(api, <AdminFeedbackPage />);
    const rows = await screen.findAllByRole('listitem');
    expect(within(rows[0]!).getByText(/appVersion: 00.01.002/)).toBeInTheDocument();
    expect(within(rows[0]!).queryByText(/demo_kid/)).not.toBeInTheDocument();
    await userEvent.selectOptions(
      within(rows[0]!).getByRole('combobox', { name: 'Status' }),
      'fixed',
    );
    expect(api.setStatus).toHaveBeenCalledWith('f1', 'fixed');
    expect(await within(rows[0]!).findByRole('status')).toHaveTextContent('Saved');
  });

  it('shows the normal not-found page to anyone without the operator role', async () => {
    show(
      fakeApi({
        listAll: vi.fn(async () =>
          Promise.reject(new FeedbackApiError(404, 'not_found', 'Not found')),
        ),
      }),
      <AdminFeedbackPage />,
    );
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('shows other errors with a retry', async () => {
    show(
      fakeApi({ listAll: vi.fn(async () => Promise.reject(new Error('down'))) }),
      <AdminFeedbackPage />,
    );
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('says when a status could not be saved', async () => {
    show(
      fakeApi({ setStatus: vi.fn(async () => Promise.reject(new Error('down'))) }),
      <AdminFeedbackPage />,
    );
    const selects = await screen.findAllByRole('combobox', { name: 'Status' });
    await userEvent.selectOptions(selects[1]!, 'new');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  });

  describe('operator error reports', () => {
    it('lists error reports grouped by screen and failing API call, behind a filter', async () => {
      const api = fakeApi();
      show(api, <AdminFeedbackPage />);
      await screen.findAllByRole('listitem');
      expect(api.errorReports).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole('button', { name: 'Error reports' }));
      const group = await screen.findByRole('listitem', { name: /\/map/ });
      expect(group).toHaveTextContent('2 reports');
      expect(group).toHaveTextContent('/v1/student/map');
      expect(group).toHaveTextContent('404');
      expect(group).toHaveTextContent('RD-VDMW5E');
      expect(group).toHaveTextContent('00.01.002-48657ff');
      await userEvent.click(screen.getByRole('button', { name: 'Feedback' }));
      expect(await screen.findByText(/appVersion: 00.01.002/)).toBeInTheDocument();
    });
  });
});

describe('short snippets of a message', () => {
  it('keeps short messages whole, cuts long ones at a word and names an empty one', () => {
    expect(snippet('Short one')).toBe('Short one');
    expect(snippet('one two three four', 10)).toBe('one two…');
    expect(snippet('abcdefghijklmnop', 5)).toBe('abcde…');
    expect(snippet(null)).toBe('No message');
  });
});
