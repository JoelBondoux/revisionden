import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { demoStats } from '../stats/mocks';

/** The week's stats with a level, as the API sends once rewards progression is on. */
function statsWithLevel() {
  server.use(
    http.get('*/v1/student/stats', () => {
      const stats = demoStats('week');
      const values = [40, 0, 60, 40, 0, 0, 0];
      return HttpResponse.json({
        ...stats,
        chart: {
          ...stats.chart,
          buckets: stats.chart.buckets.map((b, i) => ({ ...b, value: values[i] })),
        },
        level: { level: 7, xpIntoLevel: 120, xpForNextLevel: 300 },
      });
    }),
  );
}

// J15b (owner, 2026-11-26): Home is where Pip takes you: a one-screen dashboard of where you stand
// and today's goals, low on words, with one big bright call to action.
describe('Home', () => {
  it('opens after signing in: /learn and the unlock fallback go Home', async () => {
    renderRoute('/learn');
    expect(await screen.findByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument();
    const { DEFAULT_STUDENT_PAGE } = await import('../../api/unlock');
    expect(DEFAULT_STUDENT_PAGE).toBe('/home');
  });

  it('shows the level, XP and streak', async () => {
    statsWithLevel();
    renderRoute('/home');
    const level = await screen.findByRole('progressbar', { name: 'Level 7' });
    expect(level).toHaveAttribute('aria-valuetext', '120 of 300 XP to level 8');
    expect((await screen.findByText(/day streak/)).closest('p')).toHaveTextContent('4 day streak');
  });

  it("shows today's goals as rings, each saying in words what it counts (UX-1)", async () => {
    renderRoute('/home');
    const goals = await screen.findByRole('list', { name: "Today's goals" });
    expect(within(goals).getByRole('progressbar', { name: 'Daily goal' })).toHaveAttribute(
      'aria-valuetext',
      '30 of 50 XP',
    );
    expect(await within(goals).findByRole('progressbar', { name: '5-a-day' })).toBeInTheDocument();
    expect(within(goals).getByText('Daily goal: 30 of 50 XP')).toBeInTheDocument();
    expect(await within(goals).findByText(/^\d+ of \d+ questions today$/)).toBeInTheDocument();
    expect(
      await within(goals).findByRole('link', { name: /^\d+ cards? to review$/ }),
    ).toHaveAttribute('href', '/cards');
  });

  it('starts the 5-a-day from its ring', async () => {
    renderRoute('/home');
    expect(await screen.findByRole('link', { name: 'Start your 5-a-day' })).toHaveAttribute(
      'href',
      '/learn/daily',
    );
  });

  it('has one big call to action: the next mission', async () => {
    renderRoute('/home');
    const go = await screen.findByRole('link', { name: /^Go: Fix weak spot: Surds/ });
    expect(go).toHaveAttribute('href', '/learn/topic/surds');
    expect(go).toHaveClass('home-cta');
    expect(document.querySelectorAll('.home-cta')).toHaveLength(1);
  });

  it('offers a topic to pick when there is no mission', async () => {
    server.use(
      http.get('*/v1/student/map', async () => {
        const { topicMap } = await import('../../mocks/data');
        return HttpResponse.json({ ...topicMap, nextMission: null });
      }),
    );
    renderRoute('/home');
    expect(await screen.findByRole('link', { name: 'Pick a topic' })).toHaveAttribute(
      'href',
      '/map',
    );
  });

  it('lists weak spots to fix, each opening its lesson', async () => {
    renderRoute('/home');
    const fix = await screen.findByRole('list', { name: 'Fix these' });
    expect(within(fix).getByRole('link', { name: 'Surds' })).toHaveAttribute(
      'href',
      '/learn/topic/surds',
    );
  });

  it("shows the student's place in the friends league when friends are available (FL)", async () => {
    renderRoute('/home');
    expect(await screen.findByRole('link', { name: "You're 2nd this week" })).toHaveAttribute(
      'href',
      '/league',
    );
  });

  it('shows no friends league pill where friends are not available yet (UX-1)', async () => {
    server.use(
      http.get('*/v1/student/league', () =>
        HttpResponse.json({ error: { code: 'friends_not_available' } }, { status: 404 }),
      ),
    );
    renderRoute('/home');
    await screen.findByRole('list', { name: 'Fix these' });
    expect(screen.queryByText(/Friends league/)).not.toBeInTheDocument();
    expect(screen.queryByText('Soon')).not.toBeInTheDocument();
  });

  it("shows this week's days studied towards the reward", async () => {
    statsWithLevel();
    renderRoute('/home');
    const week = await screen.findByRole('list', { name: 'This week' });
    expect(within(week).getAllByRole('listitem')).toHaveLength(7);
    expect(within(week).getByText('Mon, studied')).toBeInTheDocument();
    expect(within(week).getByText('Tue, not yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rewards: 3 of 7 days this week' })).toHaveAttribute(
      'href',
      '/rewards',
    );
  });

  it('celebrates a smashed goal', async () => {
    server.use(
      http.get('*/v1/student/map', async () => {
        const { topicMap } = await import('../../mocks/data');
        return HttpResponse.json({ ...topicMap, xpToday: 195, dailyGoalXp: 50 });
      }),
    );
    renderRoute('/home');
    expect(await screen.findByText('Daily goal smashed!')).toBeInTheDocument();
  });
});
