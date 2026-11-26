import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { DEMO_CHILDREN } from './mocks';

const CHILD = DEMO_CHILDREN[0]!.id;
const LOAD = { timeout: 5000 };
// A made-up topic with a reachable, match-checked "Learn it first" link (Q6: only those show).
const WITH_LINKS = 'demo-topic-with-links';
vi.mock('../learn-links/links', async (importOriginal) => {
  const real = await importOriginal<typeof import('../learn-links/links')>();
  return {
    ...real,
    learnLinksByTopic: new Map([
      [
        'demo-topic-with-links',
        [
          {
            title: 'Demo lesson',
            url: 'https://www.thenational.academy/teachers/demo',
            provider: 'oak',
            level: 'GCSE',
            checked_at: '2026-11-25',
            match: {
              page_title: 'Demo lesson',
              teaches: 'The demo topic, at GCSE.',
              level: 'GCSE',
              checked_at: '2026-11-26',
            },
          },
        ],
      ],
    ]),
  };
});

function tricky(topics: { topicId: string; title: string; points: number }[]) {
  server.use(http.get('*/v1/students/:id/worth-a-look', () => HttpResponse.json({ topics })));
}

describe('worth a look together (parent dashboard)', () => {
  it('lists topics that have been tricky for a while, kindly', async () => {
    tricky([
      { topicId: WITH_LINKS, title: 'Demo topic A', points: 2 },
      { topicId: 'demo-topic-no-links', title: 'Demo topic B', points: 1 },
    ]);
    renderRoute(`/parent/stats?child=${CHILD}`);
    const card = await screen.findByRole('region', { name: 'Worth a look together' }, LOAD);
    expect(card).toHaveTextContent(
      'These have been tricky for a while. A chat or a look with their teacher may help.',
    );
    const rows = within(card).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Demo topic A');
    expect(rows[0]).toHaveTextContent('2 points');
    expect(rows[1]).toHaveTextContent('Demo topic B');
    expect(rows[1]).toHaveTextContent('1 point');
    expect(card.textContent).not.toMatch(/fail|wrong|weak|struggl|behind/i);
  });

  it('offers "Learn it first" only for topics that have lessons', async () => {
    tricky([
      { topicId: WITH_LINKS, title: 'Demo topic A', points: 2 },
      { topicId: 'demo-topic-no-links', title: 'Demo topic B', points: 1 },
    ]);
    renderRoute(`/parent/stats?child=${CHILD}`);
    const card = await screen.findByRole('region', { name: 'Worth a look together' }, LOAD);
    const [withLinks, withoutLinks] = within(card).getAllByRole('listitem');
    expect(within(withoutLinks!).queryByRole('button', { name: 'Learn it first' })).toBeNull();
    await userEvent.click(within(withLinks!).getByRole('button', { name: 'Learn it first' }));
    const link = within(withLinks!).getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('href')).toMatch(/^https:\/\//);
  });

  it('shows no card at all when nothing has been tricky', async () => {
    tricky([]);
    renderRoute(`/parent/stats?child=${CHILD}`);
    await screen.findByRole('region', { name: 'Study time' }, LOAD);
    expect(screen.queryByRole('region', { name: 'Worth a look together' })).toBeNull();
  });

  it("is never on the child's own My stats page", async () => {
    tricky([{ topicId: WITH_LINKS, title: 'Demo topic A', points: 2 }]);
    renderRoute('/progress');
    await screen.findByRole('region', { name: 'Today' }, LOAD);
    expect(screen.queryByText('Worth a look together')).toBeNull();
  });
});
