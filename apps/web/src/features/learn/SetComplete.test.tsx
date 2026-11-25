import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Progress } from '@revisionden/core';
import { stubReducedMotion } from '../juice/testing';
import { SetComplete } from './SetComplete';

const progress = (over: Partial<Progress> = {}): Progress => ({
  xpToday: 40,
  totalXp: 400,
  dailyGoalXp: 50,
  goalMet: false,
  streak: { current: 3, best: 5, skipDays: 0 },
  ...over,
});

function show(props: Partial<Parameters<typeof SetComplete>[0]> = {}) {
  return render(
    <MemoryRouter>
      <SetComplete correct={4} marked={5} xp={45} bestCombo={3} progress={progress()} {...props} />
    </MemoryRouter>,
  );
}

beforeEach(() => stubReducedMotion(false));
afterEach(() => vi.unstubAllGlobals());

describe('Set complete', () => {
  it('gives 2 stars for 4 of 5 and shows the XP tally and best combo', () => {
    show();
    expect(screen.getByRole('img', { name: '2 of 3 stars' })).toBeInTheDocument();
    expect(screen.getByText('4 of 5')).toBeInTheDocument();
    expect(screen.getByText('+45 XP')).toBeInTheDocument();
    expect(screen.getByText('×3')).toBeInTheDocument();
  });

  it('fills the daily goal bar', () => {
    show({ progress: progress({ xpToday: 40 }) });
    expect(screen.getByRole('progressbar', { name: 'Daily goal' })).toHaveAttribute(
      'aria-valuetext',
      '40 of 50 XP',
    );
  });

  it('leaves out best combo when there was none', () => {
    show({ bestCombo: 1 });
    expect(screen.queryByText('Best combo')).not.toBeInTheDocument();
  });

  it('after the daily cap, says see you tomorrow instead of offering another mission', () => {
    show({ progress: progress({ xpToday: 300, goalMet: true }) });
    expect(screen.queryByRole('link', { name: 'Next mission' })).not.toBeInTheDocument();
    const done = screen.getByRole('link', { name: 'Great work today. See you tomorrow' });
    expect(done).not.toHaveClass('cta-pulse');
    expect(screen.queryByText(/take a break/)).not.toBeInTheDocument();
  });

  it('works without progress (it could not be loaded)', () => {
    show({ progress: null });
    expect(screen.getByRole('link', { name: 'Next mission' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
