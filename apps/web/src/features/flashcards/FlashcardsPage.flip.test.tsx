import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));
const flipCard = () => screen.getByTestId('flip-card');
const turn = () => screen.getByRole('button', { name: /^Turn (over|back)/ });

async function openCards() {
  renderRoute('/cards');
  await screen.findByText('Demo front 1');
}

describe('Turning flashcards (F7)', () => {
  it('never shows the next card’s answer while its question is showing', async () => {
    await openCards();
    expect(screen.queryByText('Demo back 1')).not.toBeInTheDocument();
    await click('Show answer');
    expect(screen.getByText('Demo back 1')).toBeInTheDocument();
    await click(/^Good/);
    await screen.findByText('Demo front 2');
    expect(flipCard()).not.toHaveClass('flip-card--flipped');
    expect(screen.queryByText('Demo back 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Demo back 1')).not.toBeInTheDocument();
  });

  it('turns back to the question and over again as often as you like, without a new rating', async () => {
    const reviews: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST' && request.url.endsWith('/review')) reviews.push(request.url);
    });
    await openCards();
    await click('Show answer');
    await userEvent.click(turn());
    expect(flipCard()).not.toHaveClass('flip-card--flipped');
    expect(screen.getByRole('button', { name: /^Good/ })).toBeInTheDocument();
    await userEvent.click(turn());
    expect(flipCard()).toHaveClass('flip-card--flipped');

    turn().focus();
    await userEvent.keyboard(' ');
    expect(flipCard()).not.toHaveClass('flip-card--flipped');
    await userEvent.keyboard('{Enter}');
    expect(flipCard()).toHaveClass('flip-card--flipped');
    expect(reviews).toHaveLength(0);
    server.events.removeAllListeners();
  });

  it('turns the card over by tap or keyboard before the answer is shown, too', async () => {
    await openCards();
    turn().focus();
    await userEvent.keyboard('{Enter}');
    expect(flipCard()).toHaveClass('flip-card--flipped');
    expect(screen.getByText('Demo back 1')).toBeInTheDocument();
  });
});

describe('Explain on a flashcard (F7)', () => {
  it('walks through the steps one at a time, ending on the answer', async () => {
    await openCards();
    expect(screen.queryByRole('button', { name: 'Explain' })).not.toBeInTheDocument();
    await click('Show answer');
    await click('Explain');
    const panel = screen.getByRole('region', { name: 'Explain' });
    expect(within(panel).getByText('Step 1 of 3')).toBeInTheDocument();
    expect(within(panel).getByText('Demo step one')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Back' })).toBeDisabled();
    await userEvent.click(within(panel).getByRole('button', { name: 'Next step' }));
    expect(within(panel).getByText('Demo step two')).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Back' }));
    expect(within(panel).getByText('Demo step one')).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Next step' }));
    await userEvent.click(within(panel).getByRole('button', { name: 'Next step' }));
    expect(within(panel).getByText('Step 3 of 3')).toBeInTheDocument();
    expect(within(panel).getByText('Answer: Demo back 1')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Next step' })).not.toBeInTheDocument();
  });

  it('has no Explain button on a card without steps', async () => {
    await openCards();
    await click('Show answer');
    await click(/^Good/);
    await screen.findByText('Demo front 2');
    await click('Show answer');
    expect(screen.queryByRole('button', { name: 'Explain' })).not.toBeInTheDocument();
  });
});
