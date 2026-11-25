import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));

/** Opens the Cards tab and waits for the review session to show its first card. */
async function openCards() {
  renderRoute('/cards');
  const tab = await screen.findByRole('tab', { name: 'Due today (2)' });
  await screen.findByTestId('flip-card');
  return tab;
}

const SESSION_ID = '00000000-0000-4000-8000-000000000777';

function finishResult(over: Record<string, unknown>) {
  return {
    completed: true,
    reason: 'rewarded',
    xpEarned: 20,
    cardsCounted: 6,
    rewardedLeftToday: 1,
    progress: {
      xpToday: 50,
      totalXp: 250,
      dailyGoalXp: 50,
      goalMet: true,
      streak: { current: 4, best: 9, skipDays: 1 },
    },
    ...over,
  };
}

async function reviewBothCards(open = true) {
  if (open) await openCards();
  for (const front of ['Demo front 1', 'Demo front 2']) {
    await screen.findByText(front);
    await click('Show answer');
    await click(/^Good/);
  }
}

describe('Flashcards screen', () => {
  it('has tabs for due cards, all decks and my cards', async () => {
    const due = await openCards();
    expect(due).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'All decks' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'My cards' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('DRAFT CONTENT');
  });

  it('shows the deck header and progress, then flips the card to the answer', async () => {
    await openCards();
    expect(screen.getByText('GCSE Maths')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Demo topic A' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Deck progress' })).toHaveAttribute(
      'aria-valuetext',
      '0 of 2 cards',
    );
    const card = screen.getByTestId('flip-card');
    expect(card).not.toHaveClass('flip-card--flipped');
    expect(within(card).getByText('Demo front 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Good/ })).not.toBeInTheDocument();
    await click('Show answer');
    expect(card).toHaveClass('flip-card--flipped');
    expect(within(card).getByText('Demo spec reference 1')).toBeInTheDocument();
  });

  it('shows when each rating brings the card back', async () => {
    await openCards();
    await click('Show answer');
    expect(screen.getByRole('button', { name: 'Again, back in 10 min' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hard, back in 1 day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Good, back in 1 day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Easy, back in 4 days' })).toBeInTheDocument();
  });

  it('tells you a finished session earns 20 XP', async () => {
    await openCards();
    expect(await screen.findByText(/Finish the session for 20 XP/)).toBeInTheDocument();
  });

  it('brings a card rated Again back in the same session, then sums up', async () => {
    await openCards();
    await click('Show answer');
    await click(/^Again/);
    await screen.findByText('Demo front 2');
    await click('Show answer');
    await click(/^Good/);
    // The card rated Again comes back once before the session ends.
    expect(await screen.findByText('Demo front 1')).toBeInTheDocument();
    await click('Show answer');
    await click(/^Good/);
    const done = await screen.findByRole('region', { name: 'Deck done!' });
    expect(done).toHaveTextContent('1 card comes back sooner');
    expect(done).toHaveTextContent(/at least 5 cards/);
  });

  it('shows the 20 XP when a completed session is rewarded', async () => {
    server.use(
      http.post('*/v1/student/flashcards/sessions/:id/finish', () =>
        HttpResponse.json(finishResult({ reason: 'rewarded', xpEarned: 20 })),
      ),
    );
    await reviewBothCards();
    const done = await screen.findByRole('region', { name: 'Deck done!' });
    expect(done).toHaveTextContent('+20 XP');
  });

  it('explains when today’s rewarded sessions are used up', async () => {
    server.use(
      http.post('*/v1/student/flashcards/sessions', () =>
        HttpResponse.json(
          { id: SESSION_ID, maxCards: 20, minCards: 5, xp: 20, rewardedLeftToday: 0 },
          { status: 201 },
        ),
      ),
      http.post('*/v1/student/flashcards/sessions/:id/finish', () =>
        HttpResponse.json(finishResult({ reason: 'daily_limit', xpEarned: 0 })),
      ),
    );
    await openCards();
    expect(await screen.findByText(/today's 2 rewarded sessions/)).toBeInTheDocument();
    await reviewBothCards(false);
    const done = await screen.findByRole('region', { name: 'Deck done!' });
    expect(done).toHaveTextContent(/today's flashcard XP/);
  });

  it('says that finishing every due card is needed when you stop early', async () => {
    server.use(
      http.post('*/v1/student/flashcards/sessions/:id/finish', () =>
        HttpResponse.json(finishResult({ reason: 'left_early', xpEarned: 0, completed: false })),
      ),
    );
    await reviewBothCards();
    expect(await screen.findByRole('region', { name: 'Deck done!' })).toHaveTextContent(
      /every due card/,
    );
  });

  it('asks you to try again when the session cannot be saved', async () => {
    server.use(
      http.post('*/v1/student/flashcards/sessions/:id/finish', () => HttpResponse.error()),
    );
    await reviewBothCards();
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/);
    server.resetHandlers();
    await click('Try again');
    expect(await screen.findByRole('region', { name: 'Deck done!' })).toBeInTheDocument();
  });

  it('asks you to try again when a session cannot start', async () => {
    server.use(http.post('*/v1/student/flashcards/sessions', () => HttpResponse.error()));
    renderRoute('/cards');
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/);
    server.resetHandlers();
    await click('Try again');
    expect(await screen.findByText(/Finish the session for 20 XP/)).toBeInTheDocument();
  });

  it('lists all decks and reviews one', async () => {
    await openCards();
    await userEvent.click(screen.getByRole('tab', { name: 'All decks' }));
    const deck = within(screen.getByRole('tabpanel')).getByRole('listitem');
    expect(deck).toHaveTextContent('Demo topic A');
    expect(deck).toHaveTextContent('2 due of 2');
    await userEvent.click(within(deck).getByRole('button', { name: 'Review Demo topic A' }));
    expect(await screen.findByTestId('flip-card')).toBeInTheDocument();
  });

  it('lets a student add their own card', async () => {
    await openCards();
    await userEvent.click(screen.getByRole('tab', { name: 'My cards' }));
    expect(screen.getByText(/You have not made any cards yet/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Front'), 'My front');
    await userEvent.type(screen.getByLabelText('Back'), 'My back');
    await userEvent.selectOptions(screen.getByLabelText('Topic'), 'Demo topic A');
    await click('Add card');
    expect(await screen.findByText('My front')).toBeInTheDocument();
    expect(screen.getByLabelText('Front')).toHaveValue('');
  });

  it('says when nothing is due', async () => {
    server.use(
      http.get('*/v1/student/flashcards', () =>
        HttpResponse.json({ due: [], decks: [], mine: [], draftContent: false }),
      ),
    );
    renderRoute('/cards');
    expect(await screen.findByText(/Nothing is due right now/)).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('asks you to try again when a review fails', async () => {
    server.use(http.post('*/v1/student/flashcards/:id/review', () => HttpResponse.error()));
    await openCards();
    await click('Show answer');
    await click(/^Good/);
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/);
  });
});
