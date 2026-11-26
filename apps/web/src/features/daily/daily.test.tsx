import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { demoDaily } from './mocks';

// The 5-a-day loads after the map, and CI can be slow, so the mock always answers late
// (later than findBy's 1 s default) and every wait for it allows for that.
const SLOW_MS = 1200;
const WAIT = { timeout: 5000 };
const useDaily = (body: object = {}) =>
  server.use(
    http.get('*/v1/student/daily', async () => {
      await delay(SLOW_MS);
      return HttpResponse.json({ ...demoDaily, ...body });
    }),
  );

/** Notes when the app has had its 5-a-day answer, so "not shown" checks are never too early. */
function watchDaily() {
  const seen = { answered: false };
  const done = ({ request }: { request: Request }) => {
    if (new URL(request.url).pathname.endsWith('/v1/student/daily')) {
      seen.answered = true;
      server.events.removeListener('response:mocked', done);
    }
  };
  server.events.on('response:mocked', done);
  return () => waitFor(() => expect(seen.answered).toBe(true), WAIT);
}

describe('Daily 5-a-day', () => {
  // J15b: the 5-a-day moved from the map's Today strip to a ring on Home.
  it('shows the 5-a-day on Home until it is done', async () => {
    useDaily();
    renderRoute('/home');
    const ring = await screen.findByRole('progressbar', { name: '5-a-day' }, WAIT);
    expect(ring).toHaveAttribute('aria-valuetext', '0 of 2 done');
    expect(screen.getByRole('link', { name: 'Start your 5-a-day' })).toHaveAttribute(
      'href',
      '/learn/daily',
    );
  });

  it('says Continue once some are answered', async () => {
    useDaily({ answeredItemIds: [demoDaily.items[0]!.id], answered: 1 });
    renderRoute('/home');
    expect(
      await screen.findByRole('link', { name: 'Continue your 5-a-day' }, WAIT),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '5-a-day' })).toHaveAttribute(
      'aria-valuetext',
      '1 of 2 done',
    );
  });

  it('shows it done (no link) when done, and not at all when nothing has been practised yet', async () => {
    useDaily({ done: true, answered: 2, answeredItemIds: demoDaily.items.map((i) => i.id) });
    let answered = watchDaily();
    const { unmount } = renderRoute('/home');
    await answered();
    expect(await screen.findByRole('progressbar', { name: '5-a-day' }, WAIT)).toHaveAttribute(
      'aria-valuetext',
      '2 of 2 done',
    );
    expect(screen.queryByRole('link', { name: /your 5-a-day/ })).not.toBeInTheDocument();
    unmount();
    useDaily({ items: [], total: 0 });
    answered = watchDaily();
    renderRoute('/home');
    await answered();
    await screen.findByRole('link', { name: /^Go:/ }, WAIT);
    expect(screen.queryByRole('progressbar', { name: '5-a-day' })).not.toBeInTheDocument();
  });

  it('never breaks Home if the 5-a-day cannot load', async () => {
    server.use(
      http.get('*/v1/student/daily', async () => {
        await delay(SLOW_MS);
        return HttpResponse.json({}, { status: 500 });
      }),
    );
    const answered = watchDaily();
    renderRoute('/home');
    await answered();
    expect(await screen.findByRole('link', { name: /^Go:/ }, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: '5-a-day' })).not.toBeInTheDocument();
  });

  it('plays the unanswered questions in the lesson player', async () => {
    useDaily({ answeredItemIds: [demoDaily.items[0]!.id], answered: 1 });
    renderRoute('/learn/daily');
    expect(
      await screen.findByRole('heading', { level: 1, name: '5-a-day' }, WAIT),
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Demo question 1' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Your answer'), 'demo answer');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByRole('status', { name: 'Answer feedback' })).toBeInTheDocument();
  });

  it('sends a student back to the map when today is already done', async () => {
    useDaily({ done: true, answered: 2, answeredItemIds: demoDaily.items.map((i) => i.id) });
    const { router } = renderRoute('/learn/daily');
    await screen.findByRole('heading', { name: 'Topic map' }, WAIT);
    expect(router.state.location.pathname).toBe('/map');
  });
});
