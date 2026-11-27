import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { mockChoiceCard } from '../learn/mocks';

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));

/** Ratings sent for each review, in order. */
function watchRatings(): string[] {
  const ratings: string[] = [];
  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'POST' && request.url.endsWith('/review')) {
      ratings.push(((await request.clone().json()) as { rating: string }).rating);
    }
  });
  return ratings;
}

afterEach(() => server.events.removeAllListeners());

describe('multiple choice flashcards (F20)', () => {
  it('shows the choices on the card front, with no Show answer button', async () => {
    mockChoiceCard();
    renderRoute('/cards');
    await screen.findByText('Demo choice question');
    const choices = screen.getByRole('group', { name: 'Choose an answer' });
    expect(
      within(choices)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Demo option A', 'Demo option B', 'Demo option C']);
    expect(screen.queryByRole('button', { name: 'Show answer' })).not.toBeInTheDocument();
  });

  it('turns over on a right choice, says so, and rates it Good', async () => {
    mockChoiceCard();
    const ratings = watchRatings();
    renderRoute('/cards');
    await screen.findByText('Demo choice question');
    await click('Demo option B');
    expect(screen.getByTestId('flip-card')).toHaveClass('flip-card--flipped');
    expect(screen.getByText('Right!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Again/ })).not.toBeInTheDocument();
    await click('Next card');
    await screen.findByText('Demo front 1');
    expect(ratings).toEqual(['good']);
  });

  it('shows the right answer after a wrong choice, and rates it Again', async () => {
    mockChoiceCard();
    const ratings = watchRatings();
    renderRoute('/cards');
    await screen.findByText('Demo choice question');
    await click('Demo option C');
    expect(screen.getByText('Not quite. The answer is:')).toBeInTheDocument();
    expect(screen.getByText('Demo option B')).toBeInTheDocument();
    await click('Next card');
    await screen.findByText('Demo front 1');
    expect(ratings).toEqual(['again']);
  });

  it('keeps Show answer and self-rating for plain recall cards', async () => {
    renderRoute('/cards');
    await screen.findByText('Demo front 1');
    expect(screen.queryByRole('group', { name: 'Choose an answer' })).not.toBeInTheDocument();
    await click('Show answer');
    expect(screen.getByRole('button', { name: /^Good/ })).toBeInTheDocument();
  });

  it('names the topic once, in the header, not again on the card', async () => {
    renderRoute('/cards');
    await screen.findByText('Demo front 1');
    expect(screen.getAllByText('Demo topic A', { selector: 'h2, span, p' })).toHaveLength(1);
    expect(within(screen.getByTestId('flip-card')).queryByText('Demo topic A')).toBeNull();
  });
});

describe('Explain on the card (F21)', () => {
  it('puts Explain on the turned-over card face, not below the card', async () => {
    renderRoute('/cards');
    await screen.findByText('Demo front 1');
    const wrap = screen.getByTestId('flip-card-wrap');
    expect(within(wrap).queryByRole('button', { name: 'Explain' })).not.toBeInTheDocument();
    await click('Show answer');
    await click('Explain');
    expect(await screen.findByText('Demo step one')).toBeInTheDocument();
  });

  it('is on the card itself once the answer shows', async () => {
    renderRoute('/cards');
    await screen.findByText('Demo front 1');
    await click('Show answer');
    const wrap = screen.getByTestId('flip-card-wrap');
    expect(within(wrap).getByRole('button', { name: 'Explain' })).toBeInTheDocument();
  });
});
