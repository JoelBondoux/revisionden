import { screen, waitFor } from '@testing-library/react';
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
    const sessions: unknown[] = [];
    server.use(
      http.post('*/v1/student/flashcards/sessions', async ({ request }) => {
        sessions.push(await request.json());
        return HttpResponse.json(
          { id: card(99).id, maxCards: 20, minCards: 5, xp: 20, rewardedLeftToday: 2 },
          { status: 201 },
        );
      }),
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
    // The session knows it is the "10 more" batch, so finishing it counts as complete (F11b).
    await waitFor(() => expect(sessions).toEqual([{ extra: 10 }]));
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
  it('starts one new session for "10 more" after a finished one, not two (W18)', async () => {
    const sessions: unknown[] = [];
    server.use(
      http.post('*/v1/student/flashcards/sessions', async ({ request }) => {
        sessions.push(await request.json().catch(() => ({})));
        return HttpResponse.json(
          { id: card(99).id, maxCards: 20, minCards: 5, xp: 20, rewardedLeftToday: 2 },
          { status: 201 },
        );
      }),
      http.post('*/v1/student/flashcards/sessions/:id/finish', () =>
        HttpResponse.json({
          completed: false,
          reason: 'too_few_cards',
          xpEarned: 0,
          cardsCounted: 1,
          rewardedLeftToday: 2,
          progress: {
            xpToday: 0,
            totalXp: 0,
            dailyGoalXp: 50,
            goalMet: false,
            streak: { current: 0, best: 0, skipDays: 0 },
          },
          newlyEarned: [],
        }),
      ),
      http.get('*/v1/student/flashcards', ({ request }) => {
        const extra = new URL(request.url).searchParams.get('extra');
        return HttpResponse.json({
          due: extra === '10' ? [card(2)] : [card(1)],
          decks: [],
          mine: [],
          draftContent: true,
          dueToday: 1,
          backlog: extra === '10' ? 1 : 2,
          doneToday: false,
        });
      }),
    );
    renderRoute('/cards');
    await screen.findByText('Limit front 1');
    await userEvent.click(screen.getByRole('button', { name: 'Show answer' }));
    await userEvent.click(screen.getByRole('button', { name: /^Good/ }));
    await userEvent.click(await screen.findByRole('button', { name: '10 more' }));
    expect(await screen.findByText('Limit front 2')).toBeInTheDocument();
    await waitFor(() => expect(sessions).toHaveLength(2));
    // Give a stray restart time to show itself.
    await new Promise((r) => setTimeout(r, 50));
    expect(sessions).toEqual([{}, { extra: 10 }]);
  });
});
