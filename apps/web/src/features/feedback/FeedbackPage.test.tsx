import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StudentProvider } from '../../session/StudentContext';
import { FeedbackApiError, FeedbackApiProvider, type FeedbackApi } from './feedbackApi';
import { FeedbackPage } from './FeedbackPage';
import { forgetLastProblem, rememberLastProblem } from './details';

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

function show(api: FeedbackApi, { path = '/feedback', studentId = null as string | null } = {}) {
  render(
    <StudentProvider storage={{ getItem: () => studentId, setItem: () => {} }}>
      <FeedbackApiProvider value={api}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/feedback',
              search: path.split('?')[1] ? `?${path.split('?')[1]}` : '',
              state: { from: '/cards' },
            },
          ]}
        >
          <FeedbackPage />
        </MemoryRouter>
      </FeedbackApiProvider>
    </StudentProvider>,
  );
}

describe('feedback form', () => {
  it('offers the support email instead, with a note about personal details', () => {
    show(fakeApi());
    expect(screen.getByText(/Prefer email\?/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'help@revisionden.com' })).toHaveAttribute(
      'href',
      'mailto:help@revisionden.com',
    );
    expect(screen.getByText(/only the personal details we need/i)).toBeInTheDocument();
  });

  it('presets the kind from the link', () => {
    show(fakeApi(), { path: '/feedback?kind=idea' });
    expect(screen.getByRole('radio', { name: 'Idea' })).toBeChecked();
  });

  it('sends a parent report with device details by default', async () => {
    const api = fakeApi();
    show(api);
    await userEvent.click(screen.getByRole('radio', { name: 'Something confusing' }));
    await userEvent.type(screen.getByLabelText(/Tell us more/), 'The plan page is hard to read');
    expect(screen.getByText('29 / 500')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Include device details' })).toBeChecked();
    expect(screen.getByText(/Never your IP address, location or contacts/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(api.send).toHaveBeenCalledWith('parent', {
      kind: 'confusing',
      text: 'The plan page is hard to read',
      device: expect.objectContaining({ route: '/cards', online: true }),
    });
    expect(await screen.findByRole('heading', { name: 'Thank you!' })).toBeInTheDocument();
  });

  it('names the error code that was on screen, and sends it (F18)', async () => {
    rememberLastProblem('RD-VDMW5E');
    const api = fakeApi();
    show(api);
    expect(screen.getByText('Problem code: RD-VDMW5E')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Something confusing' }));
    await userEvent.type(screen.getByLabelText(/Tell us more/), 'It stopped loading');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(api.send).toHaveBeenCalledWith(
      'parent',
      expect.objectContaining({ device: expect.objectContaining({ lastProblem: 'RD-VDMW5E' }) }),
    );
    forgetLastProblem();
  });

  it("sends a student's problem code by default, without the device details (F18b)", async () => {
    rememberLastProblem('RD-VDMW5E');
    const api = fakeApi();
    show(api, { studentId: '00000000-0000-4000-8000-0000000000b1' });
    expect(screen.getByRole('checkbox', { name: 'Include device details' })).not.toBeChecked();
    expect(screen.getByText('Problem code: RD-VDMW5E')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Bug' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(api.send).toHaveBeenCalledWith('student', {
      kind: 'bug',
      device: { lastProblem: 'RD-VDMW5E' },
    });
    forgetLastProblem();
  });

  it('lets the sender remove the problem code before sending (F18b)', async () => {
    rememberLastProblem('RD-VDMW5E');
    const api = fakeApi();
    show(api, { studentId: '00000000-0000-4000-8000-0000000000b1' });
    await userEvent.click(screen.getByRole('button', { name: 'Remove problem code' }));
    expect(screen.queryByText(/Problem code:/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Bug' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(api.send).toHaveBeenCalledWith('student', { kind: 'bug' });
    forgetLastProblem();
  });

  it('keeps calling a passkey or phone problem the last problem (E8)', () => {
    rememberLastProblem('passkey:NotAllowedError:RD-7K2M9Q');
    show(fakeApi());
    expect(screen.getByText('Last problem: passkey:NotAllowedError:RD-7K2M9Q')).toBeInTheDocument();
    forgetLastProblem();
  });

  it('leaves the device details out when turned off and sends no empty text', async () => {
    const api = fakeApi();
    show(api);
    await userEvent.click(screen.getByRole('radio', { name: 'Bug' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Include device details' }));
    expect(screen.queryByText(/App version/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(api.send).toHaveBeenCalledWith('parent', { kind: 'bug' });
  });

  it('asks for a kind before sending', async () => {
    const api = fakeApi();
    show(api);
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose what kind of feedback this is.');
    expect(api.send).not.toHaveBeenCalled();
  });

  it('refuses email addresses and phone numbers before sending', async () => {
    const api = fakeApi();
    show(api, { path: '/feedback?kind=bug' });
    await userEvent.type(screen.getByLabelText(/Tell us more/), 'write to someone@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please leave out personal details');
    expect(api.send).not.toHaveBeenCalled();
  });

  it('starts with device details off for a student, who can turn them on', async () => {
    const api = fakeApi();
    show(api, { path: '/feedback?kind=bug', studentId: 'student-1' });
    const box = screen.getByRole('checkbox', { name: 'Include device details' });
    expect(box).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(api.send).toHaveBeenCalledWith('student', { kind: 'bug' });
    await userEvent.click(box);
    expect(box).toBeChecked();
  });

  it('tells a student their parent can see it, and sends as the student', async () => {
    const api = fakeApi();
    show(api, { path: '/feedback?kind=other', studentId: 'student-1' });
    expect(screen.getByText('Your parent can see what you send.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(api.send).toHaveBeenCalledWith('student', expect.objectContaining({ kind: 'other' }));
  });

  it('shows the message from the API when it refuses', async () => {
    const api = fakeApi({
      send: vi.fn(async () => {
        throw new FeedbackApiError(
          429,
          'feedback_limit',
          'You can send 5 messages a day. Try again tomorrow.',
        );
      }),
    });
    show(api, { path: '/feedback?kind=bug' });
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You can send 5 messages a day.');
  });

  it('shows a general message for other failures', async () => {
    const api = fakeApi({ send: vi.fn(async () => Promise.reject(new Error('boom'))) });
    show(api, { path: '/feedback?kind=bug' });
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });

  it('shows the reference code of a failure the server logged', async () => {
    const api = fakeApi({
      send: vi.fn(async () =>
        Promise.reject(
          new FeedbackApiError(500, 'internal_error', 'Something went wrong', 'RD-7K2M9Q'),
        ),
      ),
    });
    show(api, { path: '/feedback?kind=bug' });
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('RD-7K2M9Q');
  });
});
