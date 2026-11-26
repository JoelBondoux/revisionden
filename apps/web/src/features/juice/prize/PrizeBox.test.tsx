import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { RewardCardResponse } from '@revisionden/core';
import { stubReducedMotion } from '../testing';
import { resetParticles } from '../particles/burst';
import { PRIZE_STEP_EVENT } from '../particles/sound';
import { PrizeBox, PRIZE_TIMINGS } from './PrizeBox';

const emit = vi.hoisted(() => vi.fn(() => ({ sound: true, haptic: false })));
const playReward = vi.hoisted(() => vi.fn(() => null));
vi.mock('../../sound/SoundProvider', () => ({ useSound: () => ({ emit, playReward }) }));

const streak: RewardCardResponse = {
  id: 'streak-7',
  name: '7-day streak',
  rarity: 'common',
  items: [{ kind: 'badge', id: 'streak-7' }],
  earned: true,
  current: 7,
  target: 7,
};
const mystery: RewardCardResponse = {
  id: 'not-in-the-catalogue',
  name: 'Test reward',
  rarity: 'rare',
  items: [{ kind: 'title', text: 'Tester' }],
  earned: true,
  current: 1,
  target: 1,
};

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const untilDone = () => advance(20_000);
const sounds = () => emit.mock.calls.map((c) => (c as unknown[])[0]);

describe('the prize box (J17)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubReducedMotion(false);
    emit.mockClear();
    playReward.mockClear();
  });
  afterEach(() => {
    resetParticles();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('opens as a dialog with the box ready to tap', () => {
    render(<PrizeBox rewards={[streak]} onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'A prize box!' });
    expect(within(dialog).getByText('Tap the box to open it')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Open the prize box' })).toHaveFocus();
    expect(within(dialog).queryByRole('button', { name: 'Collect' })).not.toBeInTheDocument();
  });

  it('drops, wobbles three times, bursts open, then shows each reward one by one', () => {
    render(<PrizeBox rewards={[streak, mystery]} onClose={() => undefined} />);
    advance(PRIZE_TIMINGS.dropMs);
    expect(sounds()).toEqual(['rewardWobble']);
    advance(PRIZE_TIMINGS.wobbleMs[0] + PRIZE_TIMINGS.wobbleMs[1]);
    expect(sounds()).toEqual(['rewardWobble', 'rewardWobble', 'rewardWobble']);
    advance(PRIZE_TIMINGS.wobbleMs[2]);
    expect(sounds()).toContain('rewardOpen');
    expect(screen.getByRole('dialog', { name: 'You earned 2 rewards!' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    advance(PRIZE_TIMINGS.itemGapMs);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    untilDone();
    expect(screen.getByRole('button', { name: 'Collect' })).toHaveFocus();
  });

  it('says exactly what was earned and why (no mystery, no random draw)', () => {
    render(<PrizeBox rewards={[streak, mystery]} onClose={() => undefined} />);
    untilDone();
    const [first, second] = screen.getAllByRole('listitem');
    expect(first).toHaveTextContent('7-day streak');
    expect(first).toHaveTextContent('Badge');
    expect(first).toHaveTextContent(/For: /);
    // Not in the catalogue: we never make a reason up.
    expect(second).toHaveTextContent('Test reward');
    expect(second).not.toHaveTextContent(/For: /);
  });

  it('plays a step sound for each reward as it pops out', () => {
    render(<PrizeBox rewards={[streak, mystery]} onClose={() => undefined} />);
    untilDone();
    const calls = emit.mock.calls as unknown as [string, { step?: number }?][];
    const afterOpen = calls.slice(sounds().indexOf('rewardOpen') + 1);
    expect(afterOpen.map(([, o]) => o?.step)).toEqual([1, 2]);
    expect(afterOpen.map(([e]) => e)).toEqual([PRIZE_STEP_EVENT, PRIZE_STEP_EVENT]);
  });

  it('opens straight away when the box is tapped mid-wobble', () => {
    render(<PrizeBox rewards={[streak]} onClose={() => undefined} />);
    advance(PRIZE_TIMINGS.dropMs + 10);
    fireEvent.click(screen.getByRole('button', { name: 'Open the prize box' }));
    expect(sounds()).toContain('rewardOpen');
    expect(screen.getByRole('dialog', { name: 'You earned a reward!' })).toBeInTheDocument();
    expect(sounds().filter((s) => s === 'rewardWobble')).toHaveLength(1);
  });

  it('with reduced motion, opens at once with the full list and no particles', () => {
    stubReducedMotion(true);
    render(<PrizeBox rewards={[streak, mystery]} onClose={() => undefined} />);
    expect(screen.getByRole('dialog', { name: 'You earned 2 rewards!' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Collect' })).toHaveFocus();
    expect(document.querySelectorAll('.fx-particle')).toHaveLength(0);
    expect(sounds()).not.toContain('rewardWobble');
  });

  it('plays the reward’s own tiered sound once, as Collect appears', () => {
    render(<PrizeBox rewards={[streak, mystery]} onClose={() => undefined} />);
    expect(playReward).not.toHaveBeenCalled();
    untilDone();
    expect(playReward).toHaveBeenCalledTimes(1);
  });

  it('Collect closes it', () => {
    const onClose = vi.fn();
    render(<PrizeBox rewards={[streak]} onClose={onClose} />);
    untilDone();
    fireEvent.click(screen.getByRole('button', { name: 'Collect' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape closes it, even before it has opened', () => {
    const onClose = vi.fn();
    render(<PrizeBox rewards={[streak]} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps Tab inside the box', () => {
    render(<PrizeBox rewards={[streak]} onClose={() => undefined} />);
    untilDone();
    const collect = screen.getByRole('button', { name: 'Collect' });
    const box = screen.getByRole('button', { name: /prize box/i });
    collect.focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(box).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
    expect(collect).toHaveFocus();
  });
});
