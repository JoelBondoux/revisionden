import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  FeedbackApiError,
  FeedbackApiProvider,
  type FeedbackApi,
  type TriageFeedback,
} from './feedbackApi';
import { AdminFeedbackPage, FeedbackListPage } from './lists';

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
  },
];

function fakeApi(overrides: Partial<FeedbackApi> = {}): FeedbackApi {
  return {
    send: vi.fn(),
    listOwn: vi.fn(async () => [items[0]!]),
    listFamily: vi.fn(async () => items),
    listAll: vi.fn(async () => items),
    setStatus: vi.fn(async (id, status) => ({ ...items.find((i) => i.id === id)!, status })),
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
});
