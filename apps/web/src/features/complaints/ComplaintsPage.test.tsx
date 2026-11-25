import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ComplaintsPage } from './ComplaintsPage';
import { ComplaintsApiError, type Complaint, type ComplaintsApi } from './complaintsApi';

const resolved: Complaint = {
  id: 'c1',
  status: 'resolved',
  summary: 'Demo complaint: the timer was unfair',
  aboutPersonalData: true,
  receivedAt: '2026-11-20T10:00:00.000Z',
  acknowledgeDueAt: '2026-11-24T23:59:59.999Z',
  resolveDueAt: '2026-12-04T23:59:59.999Z',
  acknowledgedAt: '2026-11-21T10:00:00.000Z',
  resolvedAt: '2026-11-25T10:00:00.000Z',
  escalationFrom: '2026-01-02T23:59:59.999Z',
  outcome: 'We changed the timer.',
  messages: [
    { from: 'operator', body: 'We are looking into it', createdAt: '2026-11-21T10:00:00.000Z' },
  ],
};

function fakeApi(overrides: Partial<ComplaintsApi> = {}): ComplaintsApi {
  return {
    list: vi.fn(async () => [resolved]),
    create: vi.fn(async () => ({
      id: 'c2',
      acknowledgeDueAt: '2026-11-27T23:59:59.999Z',
      resolveDueAt: '2026-12-09T23:59:59.999Z',
    })),
    addMessage: vi.fn(async () => {}),
    escalate: vi.fn(async () => {}),
    listRequests: vi.fn(async () => []),
    dismissRequest: vi.fn(async () => {}),
    ...overrides,
  };
}

const show = (api: ComplaintsApi) =>
  render(
    <MemoryRouter>
      <ComplaintsPage api={api} />
    </MemoryRouter>,
  );

describe('Make a complaint (parent)', () => {
  it('explains the timescales and links to the complaints policy', async () => {
    show(fakeApi());
    expect(screen.getByRole('heading', { name: 'Make a complaint' })).toBeInTheDocument();
    expect(screen.getByText(/We aim to reply within 2 working days/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'complaints policy' })).toHaveAttribute(
      'href',
      '/legal/complaints-policy',
    );
    await screen.findByText('Demo complaint: the timer was unfair');
  });

  it('sends a complaint and says when we will reply', async () => {
    const api = fakeApi({ list: vi.fn(async () => []) });
    show(api);
    await userEvent.type(screen.getByLabelText('What went wrong?'), 'The marks were wrong');
    await userEvent.click(screen.getByLabelText(/how we use personal data/));
    await userEvent.click(screen.getByRole('button', { name: 'Send complaint' }));
    expect(api.create).toHaveBeenCalledWith({
      summary: 'The marks were wrong',
      aboutPersonalData: true,
    });
    expect(await screen.findByText(/We aim to reply by Friday 27 November/)).toBeInTheDocument();
  });

  it('shows replies, the outcome and, for personal data, where else to go', async () => {
    show(fakeApi());
    const item = (await screen.findByText('Demo complaint: the timer was unfair')).closest('li')!;
    expect(within(item).getByText('Resolved')).toBeInTheDocument();
    expect(within(item).getByText('We are looking into it')).toBeInTheDocument();
    expect(within(item).getByText('We changed the timer.')).toBeInTheDocument();
    expect(within(item).getByText(/Information Commissioner's Office \(ICO\)/)).toBeInTheDocument();
  });

  it('offers a manager review once 5 working days have passed since we acknowledged it', async () => {
    const waiting = {
      ...resolved,
      status: 'acknowledged' as const,
      resolvedAt: null,
      outcome: null,
    };
    const early = { ...waiting, id: 'c3', escalationFrom: '2999-01-01T23:59:59.999Z' };
    const api = fakeApi({ list: vi.fn(async () => [waiting, early]) });
    show(api);
    const buttons = await screen.findAllByRole('button', { name: 'Ask for a manager to review' });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]!);
    expect(api.escalate).toHaveBeenCalledWith('c1');
  });

  it("starts a complaint from a child's request with the topic, not the child's note", async () => {
    const api = fakeApi({
      list: vi.fn(async () => []),
      listRequests: vi.fn(async () => [
        {
          id: 'r1',
          nickname: 'demo_kid',
          topic: 'marking' as const,
          topicLabel: 'A mark or a question seemed wrong',
          note: 'Question 3',
          createdAt: '2026-11-25T09:00:00.000Z',
        },
      ]),
    });
    show(api);
    const request = (await screen.findByText(/demo_kid asked you/)).closest('li')!;
    expect(within(request).getByText('Question 3')).toBeInTheDocument();
    await userEvent.click(within(request).getByRole('button', { name: 'Start a complaint' }));
    const box = screen.getByLabelText('What went wrong?') as HTMLTextAreaElement;
    expect(box.value).toBe('Raised for my child: A mark or a question seemed wrong.');
    await userEvent.click(screen.getByRole('button', { name: 'Send complaint' }));
    expect(api.create).toHaveBeenCalledWith({
      summary: 'Raised for my child: A mark or a question seemed wrong.',
      aboutPersonalData: false,
      fromRequestId: 'r1',
    });
  });

  it("dismisses a child's request", async () => {
    const api = fakeApi({
      list: vi.fn(async () => []),
      listRequests: vi.fn(async () => [
        {
          id: 'r2',
          nickname: 'demo_kid',
          topic: 'unfair' as const,
          topicLabel: 'Something felt unfair',
          note: null,
          createdAt: '2026-11-25T09:00:00.000Z',
        },
      ]),
    });
    show(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(api.dismissRequest).toHaveBeenCalledWith('r2');
  });

  it('adds a follow-up message to an open complaint', async () => {
    const open = { ...resolved, status: 'acknowledged' as const, resolvedAt: null, outcome: null };
    const api = fakeApi({ list: vi.fn(async () => [open]) });
    show(api);
    await userEvent.type(await screen.findByLabelText('Add a message'), 'It happened again');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(api.addMessage).toHaveBeenCalledWith('c1', 'It happened again');
  });

  it('says what to change when the API refuses the text', async () => {
    const api = fakeApi({
      list: vi.fn(async () => []),
      create: vi.fn(async () => {
        throw new ComplaintsApiError(400, 'personal_details', 'Please leave out email addresses.');
      }),
    });
    show(api);
    await userEvent.type(screen.getByLabelText('What went wrong?'), 'Mail me at a@b.co');
    await userEvent.click(screen.getByRole('button', { name: 'Send complaint' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please leave out email addresses.');
  });
});
