import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));

async function openCards() {
  renderRoute('/cards');
  return screen.findByRole('tab', { name: 'Due today (2)' });
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

  it('ends the deck with XP and how many cards come back sooner', async () => {
    await openCards();
    await click('Show answer');
    await click(/^Again/);
    await screen.findByText('Demo front 2');
    await click('Show answer');
    await click(/^Good/);
    const done = await screen.findByRole('region', { name: 'Deck done!' });
    expect(done).toHaveTextContent('+4 XP');
    expect(done).toHaveTextContent('1 card comes back sooner');
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
