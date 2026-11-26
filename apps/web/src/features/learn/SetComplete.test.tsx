import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Progress } from '@revisionden/core';
import { stubReducedMotion } from '../juice/testing';
import { resetParticles } from '../juice/particles/burst';
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
afterEach(() => {
  resetParticles();
  vi.unstubAllGlobals();
});

const particles = () => document.querySelectorAll('.fx-layer .fx-particle');

describe('Set complete', () => {
  it('bursts the style’s particles for a finished topic (J17)', () => {
    show();
    expect(particles().length).toBeGreaterThan(0);
  });

  it('bursts nothing with reduced motion', () => {
    stubReducedMotion(true);
    show();
    expect(particles()).toHaveLength(0);
  });

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

  it('at the daily limit in minutes, says see you tomorrow even with little XP today', () => {
    const dailyLimit = {
      limitMinutes: 60,
      usedMinutes: 60,
      leftMinutes: 0,
      reached: true,
      dayType: 'school' as const,
      examSeason: false,
    };
    show({ progress: progress({ xpToday: 40, dailyLimit }) });
    expect(screen.queryByRole('link', { name: 'Next mission' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Great work today. See you tomorrow' }),
    ).toBeInTheDocument();
  });

  it('offers another mission while minutes are left', () => {
    const dailyLimit = {
      limitMinutes: 60,
      usedMinutes: 20,
      leftMinutes: 40,
      reached: false,
      dayType: 'school' as const,
      examSeason: false,
    };
    show({ progress: progress({ dailyLimit }) });
    expect(screen.getByRole('link', { name: 'Next mission' })).toBeInTheDocument();
  });

  it('works without progress (it could not be loaded)', () => {
    show({ progress: null });
    expect(screen.getByRole('link', { name: 'Next mission' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
