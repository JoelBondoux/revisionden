import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { demoDaily } from './mocks';

const useDaily = (body: object) =>
  server.use(http.get('*/v1/student/daily', () => HttpResponse.json({ ...demoDaily, ...body })));

describe('Daily 5-a-day', () => {
  it('shows a 5-a-day card at the top of the topic map until it is done', async () => {
    renderRoute('/map');
    const card = await screen.findByRole('region', { name: '5-a-day' });
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
    expect(await screen.findByRole('link', { name: 'Continue your 5-a-day' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '5-a-day' })).toHaveTextContent('1 of 2 done');
  });

  it('is gone from the map when done, and when nothing has been practised yet', async () => {
    useDaily({ done: true, answered: 2, answeredItemIds: demoDaily.items.map((i) => i.id) });
    const { unmount } = renderRoute('/map');
    await screen.findByRole('heading', { name: 'Topic map' });
    await screen.findByRole('region', { name: 'Next mission' });
    expect(screen.queryByRole('region', { name: '5-a-day' })).not.toBeInTheDocument();
    unmount();
    useDaily({ items: [], total: 0 });
    renderRoute('/map');
    await screen.findByRole('region', { name: 'Next mission' });
    expect(screen.queryByRole('region', { name: '5-a-day' })).not.toBeInTheDocument();
  });

  it('never breaks the map if the 5-a-day cannot load', async () => {
    server.use(http.get('*/v1/student/daily', () => HttpResponse.json({}, { status: 500 })));
    renderRoute('/map');
    expect(await screen.findByRole('region', { name: 'Next mission' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '5-a-day' })).not.toBeInTheDocument();
  });

  it('plays the unanswered questions in the lesson player', async () => {
    useDaily({ answeredItemIds: [demoDaily.items[0]!.id], answered: 1 });
    renderRoute('/learn/daily');
    expect(await screen.findByRole('heading', { level: 1, name: '5-a-day' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Demo question 1' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Your answer'), 'demo answer');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(await screen.findByRole('status', { name: 'Answer feedback' })).toBeInTheDocument();
  });

  it('sends a student back to the map when today is already done', async () => {
    useDaily({ done: true, answered: 2, answeredItemIds: demoDaily.items.map((i) => i.id) });
    const { router } = renderRoute('/learn/daily');
    await screen.findByRole('heading', { name: 'Topic map' });
    expect(router.state.location.pathname).toBe('/map');
  });
});
