import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { RewardCardResponse } from '@revisionden/core';
import { stubReducedMotion } from '../juice/testing';
import { NewRewards } from './NewRewards';

const card = (id: string, name: string): RewardCardResponse => ({
  id,
  name,
  rarity: 'common',
  items: [],
  earned: true,
  current: 1,
  target: 1,
});

function show(rewards: readonly RewardCardResponse[]) {
  return render(
    <MemoryRouter>
      <NewRewards rewards={rewards} />
    </MemoryRouter>,
  );
}

beforeEach(() => stubReducedMotion(true));
afterEach(() => vi.unstubAllGlobals());

describe('New rewards (J17: in a prize box)', () => {
  it('opens the prize box and keeps the plain announcement beside it', () => {
    show([card('streak-7', '7-day streak')]);
    expect(screen.getByRole('dialog', { name: 'You earned a reward!' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'New rewards' })).toHaveTextContent(
      'New reward: 7-day streak',
    );
  });

  it('closes the box on Collect, leaving the announcement and the rewards link', () => {
    show([card('streak-7', '7-day streak')]);
    fireEvent.click(screen.getByRole('button', { name: 'Collect' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See your rewards' })).toHaveAttribute(
      'href',
      '/rewards',
    );
  });

  it('opens a fresh box for rewards earned later, but not again for the same ones', () => {
    const first = [card('streak-7', '7-day streak')];
    const { rerender } = show(first);
    fireEvent.click(screen.getByRole('button', { name: 'Collect' }));
    rerender(
      <MemoryRouter>
        <NewRewards rewards={[...first]} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <NewRewards rewards={[card('xp-1000', '1,000 XP')]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('dialog', { name: 'You earned a reward!' })).toBeInTheDocument();
  });

  it('shows nothing when there are no new rewards', () => {
    const { container } = show([]);
    expect(container).toBeEmptyDOMElement();
  });
});
