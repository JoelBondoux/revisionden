import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';

const nextReviewMs = { again: 600_000, hard: 86_400_000, good: 86_400_000, easy: 345_600_000 };
const card = (n: number) => ({
  id: `00000000-0000-4000-8000-0000000004${String(n).padStart(2, '0')}`,
  topicId: 'demo-topic-a',
  topicTitle: 'Demo topic A',
  subjectId: 'gcse-maths',
  origin: 'deck',
  front: `Limit front ${n}`,
  back: `Limit back ${n}`,
  draft: true,
  dueAt: '2026-11-24T10:00:00.000Z',
  nextReviewMs,
});

beforeEach(() =>
  server.use(
    http.post('*/v1/student/flashcards/:id/review', ({ params }) =>
      HttpResponse.json({ card: card(1), comesBackSooner: false, cardsCounted: 1, id: params.id }),
    ),
  ),
);

describe('daily flashcard limit (F11)', () => {
  it('says "Done for today!" when today\'s cards are done, and offers 10 more', async () => {
    const asked: (string | null)[] = [];
    server.use(
      http.get('*/v1/student/flashcards', ({ request }) => {
        const extra = new URL(request.url).searchParams.get('extra');
        asked.push(extra);
        return HttpResponse.json(
          extra === '10'
            ? {
                due: [card(1), card(2)],
                decks: [],
                mine: [],
                draftContent: true,
                dueToday: 2,
                backlog: 2,
                doneToday: false,
              }
            : {
                due: [],
                decks: [],
                mine: [],
                draftContent: true,
                dueToday: 0,
                backlog: 2,
                doneToday: true,
              },
        );
      }),
    );
    renderRoute('/cards');
    expect(await screen.findByRole('heading', { name: 'Done for today!' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Due today (0)' })).toBeInTheDocument();
    expect(screen.getByText(/come back tomorrow/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '10 more' }));
    expect(await screen.findByText('Limit front 1')).toBeInTheDocument();
    expect(asked).toContain('10');
  });

  it('has no "10 more" when nothing else is due', async () => {
    server.use(
      http.get('*/v1/student/flashcards', () =>
        HttpResponse.json({
          due: [],
          decks: [],
          mine: [],
          draftContent: true,
          dueToday: 0,
          backlog: 0,
          doneToday: false,
        }),
      ),
    );
    renderRoute('/cards');
    expect(await screen.findByText(/Nothing is due right now/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '10 more' })).not.toBeInTheDocument();
  });

  it('ends a session that used up today\'s cards on "Done for today!", with 10 more', async () => {
    server.use(
      http.get('*/v1/student/flashcards', () =>
        HttpResponse.json({
          due: [card(1)],
          decks: [],
          mine: [],
          draftContent: true,
          dueToday: 1,
          backlog: 6,
          doneToday: false,
        }),
      ),
    );
    renderRoute('/cards');
    await screen.findByText('Limit front 1');
    await userEvent.click(screen.getByRole('button', { name: 'Show answer' }));
    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));
    expect(await screen.findByRole('heading', { name: 'Done for today!' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10 more' })).toBeInTheDocument();
  });
});
