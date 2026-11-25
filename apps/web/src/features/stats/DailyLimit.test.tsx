import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { demoStudentLimit, resetDailyLimitMocks } from './mocks';

/** The panels load after the page's own data, so give slow CI machines time. */
const LOAD = { timeout: 5000 };

beforeEach(() => resetDailyLimitMocks());

describe('daily limit for the student', () => {
  it('shows minutes left today on My stats', async () => {
    renderRoute('/progress');
    const card = await screen.findByRole('region', { name: 'Today' }, LOAD);
    expect(card).toHaveTextContent('35 minutes left');
    expect(within(card).getByRole('progressbar', { name: 'Daily limit' })).toHaveAttribute(
      'aria-valuetext',
      '25 of 60 minutes',
    );
  });

  it('says see you tomorrow at the limit', async () => {
    server.use(
      http.get('*/v1/student/daily-limit', () =>
        HttpResponse.json({
          ...demoStudentLimit(),
          usedMinutes: 60,
          leftMinutes: 0,
          reached: true,
        }),
      ),
    );
    renderRoute('/progress');
    const card = await screen.findByRole('region', { name: 'Today' }, LOAD);
    expect(card).toHaveTextContent('Great work today. See you tomorrow');
  });

  it('tells the student once when a parent changes the limit', async () => {
    server.use(
      http.get('*/v1/student/daily-limit', () =>
        HttpResponse.json({
          ...demoStudentLimit(),
          changed: { schoolDayMinutes: 50, otherDayMinutes: 80 },
        }),
      ),
    );
    let seen = false;
    server.use(
      http.post('*/v1/student/daily-limit/seen', () => {
        seen = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderRoute('/progress');
    const notice = await screen.findByRole('status', { name: 'Daily limit changed' }, LOAD);
    expect(notice).toHaveTextContent('50 minutes on school days and 80 minutes on other days');
    await userEvent.click(within(notice).getByRole('button', { name: 'Got it' }));
    expect(seen).toBe(true);
    expect(screen.queryByRole('status', { name: 'Daily limit changed' })).not.toBeInTheDocument();
  });
});

describe('daily limit for the parent', () => {
  const openPanel = async () => {
    renderRoute('/parent/stats');
    return screen.findByRole('region', { name: 'Daily limit' }, LOAD);
  };

  it('shows the limits, whether they are the defaults, and today', async () => {
    const panel = await openPanel();
    expect(panel).toHaveTextContent('School days: 60 minutes (default)');
    expect(panel).toHaveTextContent('Other days: 90 minutes (default)');
    expect(panel).toHaveTextContent('Today: 25 of 60 minutes');
  });

  it('lets a parent change the limit', async () => {
    const panel = await openPanel();
    const school = within(panel).getByLabelText('School days (minutes)');
    await userEvent.clear(school);
    await userEvent.type(school, '45');
    await userEvent.click(within(panel).getByLabelText('Add 30 minutes in exam season'));
    await userEvent.click(within(panel).getByRole('button', { name: 'Save limit' }));
    expect(await within(panel).findByText('School days: 45 minutes (set by you)')).toBeVisible();
    expect(within(panel).getByRole('status')).toHaveTextContent('Saved');
  });

  it('shows a suggestion with its reason; the parent can accept it', async () => {
    resetDailyLimitMocks({ withSuggestion: true });
    const panel = await openPanel();
    const suggestion = within(panel).getByRole('group', { name: 'Suggestion' });
    expect(suggestion).toHaveTextContent('Ease off by 10 minutes');
    expect(suggestion).toHaveTextContent('No rest days in the last two weeks.');
    await userEvent.click(within(suggestion).getByRole('button', { name: 'Accept' }));
    expect(await within(panel).findByText('School days: 50 minutes (set by you)')).toBeVisible();
    expect(within(panel).queryByRole('group', { name: 'Suggestion' })).not.toBeInTheDocument();
  });

  it('lets the parent change a suggestion before saving it, or dismiss it', async () => {
    resetDailyLimitMocks({ withSuggestion: true });
    const panel = await openPanel();
    const suggestion = within(panel).getByRole('group', { name: 'Suggestion' });
    await userEvent.click(within(suggestion).getByRole('button', { name: 'Change' }));
    expect(within(panel).getByLabelText('School days (minutes)')).toHaveValue(50);
    await userEvent.click(within(suggestion).getByRole('button', { name: 'Dismiss' }));
    expect(within(panel).queryByRole('group', { name: 'Suggestion' })).not.toBeInTheDocument();
    expect(panel).toHaveTextContent('School days: 60 minutes (default)');
  });

  it('shows a friendly message when the limit cannot be saved', async () => {
    server.use(
      http.put('*/v1/students/:id/daily-limit', () => HttpResponse.json({}, { status: 500 })),
    );
    const panel = await openPanel();
    await userEvent.click(within(panel).getByRole('button', { name: 'Save limit' }));
    expect(await within(panel).findByRole('alert')).toHaveTextContent('Could not save');
  });
});
