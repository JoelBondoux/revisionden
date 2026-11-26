import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { BUG_BUTTON_KEY } from './bugButtonContext';

const bugButton = () => screen.queryByRole('button', { name: 'Report a bug' });

afterEach(() => window.localStorage.clear());

describe('bug button on every screen', () => {
  it.each([
    ['a student app page', '/map', 'student-1'],
    ['a focused page', '/family', 'student-1'],
    ['a public page with nobody chosen', '/about', null],
  ])('shows on %s', async (_, path, studentId) => {
    renderRoute(path, { studentId });
    await screen.findByRole('heading', { level: 1 });
    expect(bugButton()).toBeInTheDocument();
  });

  it('keeps clear of the content by padding the main area', async () => {
    renderRoute('/map');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('main')).toHaveClass('has-bug-button');
  });

  it('can be switched off and on again in Settings', async () => {
    renderRoute('/settings/more');
    const toggle = await screen.findByRole('checkbox', { name: 'Show the bug button' });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(bugButton()).not.toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveClass('has-bug-button');
    expect(window.localStorage.getItem(BUG_BUTTON_KEY)).toBe('off');
    await userEvent.click(toggle);
    expect(bugButton()).toBeInTheDocument();
  });

  it('stays off on other screens once switched off on this device', async () => {
    window.localStorage.setItem(BUG_BUTTON_KEY, 'off');
    renderRoute('/family');
    await screen.findByRole('heading', { level: 1 });
    expect(bugButton()).not.toBeInTheDocument();
  });

  it('hides while the starting test (Test mode) shows its questions', async () => {
    renderRoute('/learn/subject/gcse-maths/start');
    expect(bugButton()).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByText(/5:00|4:59/)).toBeInTheDocument();
    expect(bugButton()).not.toBeInTheDocument();
  });
});

describe('Bug Hunter reward notice', () => {
  const reward = {
    id: 'f1',
    outcome: 'confirmed',
    rewardXp: 50,
    message: 'Your bug report helped! +50 XP',
    confirmedAt: '2026-11-25T10:00:00.000Z',
  };

  it('tells the student about each confirmed bug once, then marks them seen', async () => {
    let seen: unknown;
    server.use(
      http.get('*/v1/student/feedback/rewards', () =>
        HttpResponse.json({
          rewards: [
            reward,
            { ...reward, id: 'f2', outcome: 'duplicate', message: 'Thanks! +20 XP' },
          ],
        }),
      ),
      http.post('*/v1/student/feedback/rewards/seen', async ({ request }) => {
        seen = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderRoute('/map');
    expect(await screen.findByText('Your bug report helped! +50 XP')).toBeInTheDocument();
    await vi.waitFor(() => expect(seen).toEqual({ ids: ['f1', 'f2'] }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(await screen.findByText('Thanks! +20 XP')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Thanks! +20 XP')).not.toBeInTheDocument();
  });

  it('stays quiet when there is nothing new or the request fails', async () => {
    const seen = vi.fn();
    server.use(
      http.get('*/v1/student/feedback/rewards', () => new HttpResponse(null, { status: 500 })),
      http.post('*/v1/student/feedback/rewards/seen', () => {
        seen();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderRoute('/map');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    expect(seen).not.toHaveBeenCalled();
  });

  it('does not ask when no student uses the device', async () => {
    const asked = vi.fn();
    server.use(
      http.get('*/v1/student/feedback/rewards', () => {
        asked();
        return HttpResponse.json({ rewards: [reward] });
      }),
    );
    renderRoute('/about', { studentId: null });
    await screen.findByRole('heading', { level: 1 });
    expect(asked).not.toHaveBeenCalled();
  });
});
