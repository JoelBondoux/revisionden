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
  it('shows a 5-a-day card at the top of the topic map until it is done', async () => {
    useDaily();
    renderRoute('/map');
    const card = await screen.findByRole('region', { name: '5-a-day' }, WAIT);
    expect(card).toHaveTextContent('0 of 2 done');
    expect(screen.getByRole('link', { name: 'Start your 5-a-day' })).toHaveAttribute(
      'href',
      '/learn/daily',
    );
    // It comes before the next mission.
    const mission = screen.getByRole('region', { name: 'Next mission' });
    expect(card.compareDocumentPosition(mission) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('says Continue once some are answered', async () => {
    useDaily({ answeredItemIds: [demoDaily.items[0]!.id], answered: 1 });
    renderRoute('/map');
    expect(
      await screen.findByRole('link', { name: 'Continue your 5-a-day' }, WAIT),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '5-a-day' })).toHaveTextContent('1 of 2 done');
  });

  it('is gone from the map when done, and when nothing has been practised yet', async () => {
    useDaily({ done: true, answered: 2, answeredItemIds: demoDaily.items.map((i) => i.id) });
    let answered = watchDaily();
    const { unmount } = renderRoute('/map');
    await answered();
    await screen.findByRole('region', { name: 'Next mission' }, WAIT);
    expect(screen.queryByRole('region', { name: '5-a-day' })).not.toBeInTheDocument();
    unmount();
    useDaily({ items: [], total: 0 });
    answered = watchDaily();
    renderRoute('/map');
    await answered();
    await screen.findByRole('region', { name: 'Next mission' }, WAIT);
    expect(screen.queryByRole('region', { name: '5-a-day' })).not.toBeInTheDocument();
  });

  it('never breaks the map if the 5-a-day cannot load', async () => {
    server.use(
      http.get('*/v1/student/daily', async () => {
        await delay(SLOW_MS);
        return HttpResponse.json({}, { status: 500 });
      }),
    );
    const answered = watchDaily();
    renderRoute('/map');
    await answered();
    expect(await screen.findByRole('region', { name: 'Next mission' }, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '5-a-day' })).not.toBeInTheDocument();
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
