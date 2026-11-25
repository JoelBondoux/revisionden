import { render, screen, within } from '@testing-library/react';
import type { RewardCardResponse } from '@revisionden/core';
import { stubReducedMotion } from '../juice/testing';
import { RewardReveal, rewardReason } from './RewardReveal';

const card = (over: Partial<RewardCardResponse>): RewardCardResponse => ({
  id: 'streak-7',
  name: '7-day streak',
  rarity: 'common',
  items: [{ kind: 'badge', id: 'streak-7' }],
  earned: true,
  current: 7,
  target: 7,
  ...over,
});

beforeEach(() => stubReducedMotion(false));
afterEach(() => vi.unstubAllGlobals());

describe('why a reward was earned', () => {
  it('names the target for milestone and level rewards', () => {
    expect(rewardReason('streak-7')).toBe('7-day streak');
    expect(rewardReason('level-2')).toBe('Level 2');
  });

  it('names the collection that was completed', () => {
    expect(rewardReason('gig-kit-complete')).toMatch(/^Completed the .+ collection$/);
  });

  it('names the season challenge', () => {
    expect(rewardReason('autumn-1-2026-1')).toMatch(/^25 .+ in .+$/);
  });

  it('says nothing it cannot back up for an unknown reward', () => {
    expect(rewardReason('not-a-reward')).toBeNull();
  });
});

describe('reward reveal', () => {
  it('shows exactly what was earned, its tier and why: no mystery boxes', () => {
    render(
      <RewardReveal rewards={[card({ id: 'level-2', name: 'Mint theme', rarity: 'rare' })]} />,
    );
    const reveal = screen.getByRole('listitem');
    expect(reveal).toHaveClass('reward-reveal--rare');
    expect(within(reveal).getByText('New: Mint theme')).toBeInTheDocument();
    expect(within(reveal).getByText('Rare')).toBeInTheDocument();
    expect(within(reveal).getByText('For: Level 2')).toBeInTheDocument();
    expect(within(reveal).getByText(/Badge/)).toBeInTheDocument();
  });

  it('matches each of the four tiers, common to legendary', () => {
    const rarities = ['common', 'rare', 'epic', 'legendary'] as const;
    render(
      <RewardReveal
        rewards={rarities.map((rarity, i) => card({ id: `x-${i}`, name: `R${i}`, rarity }))}
      />,
    );
    const items = screen.getAllByRole('listitem');
    rarities.forEach((rarity, i) => expect(items[i]).toHaveClass(`reward-reveal--${rarity}`));
  });

  it('bursts particles for epic and legendary rewards only, and never with reduced motion', () => {
    const { unmount } = render(
      <RewardReveal
        rewards={[card({ id: 'a', rarity: 'common' }), card({ id: 'b', rarity: 'legendary' })]}
      />,
    );
    const [common, legendary] = screen.getAllByRole('listitem');
    expect(common!.querySelector('.burst')).toBeNull();
    expect(legendary!.querySelector('.burst')).not.toBeNull();
    unmount();
    stubReducedMotion(true);
    render(<RewardReveal rewards={[card({ id: 'b', rarity: 'legendary' })]} />);
    expect(document.querySelector('.burst')).toBeNull();
  });

  it('shows nothing when there is nothing new', () => {
    const { container } = render(<RewardReveal rewards={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
