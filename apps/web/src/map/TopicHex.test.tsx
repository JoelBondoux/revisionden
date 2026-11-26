import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { MapTopic as Topic } from '@revisionden/core';
import { nameStartsWithText } from '../test/nameMatchesText';
import { ChallengeHex, TopicHex } from './TopicHex';

function renderHex(topic: Topic, onLocked = vi.fn()) {
  render(
    <MemoryRouter>
      <TopicHex topic={topic} onLocked={onLocked} />
    </MemoryRouter>,
  );
  return onLocked;
}

const base = { id: 't1', title: 'Surds', lessonId: 'surds' };

describe('TopicHex', () => {
  it('shows a mastered topic in gold with a tick', () => {
    renderHex({ ...base, status: 'mastered', mastery: 100 });
    const hex = screen.getByRole('link', { name: 'Surds, mastered' });
    expect(hex).toHaveClass('hex--mastered');
    expect(hex).toHaveAttribute('href', '/learn/topic/surds');
  });

  it('shows an in-progress topic with its mastery level and percentage', () => {
    renderHex({ ...base, status: 'in-progress', mastery: 45 });
    const hex = screen.getByRole('link', { name: 'Surds, 45% mastered' });
    expect(hex).toHaveTextContent('45%');
    expect(hex.querySelector<HTMLElement>('.hex__fill')!.style.height).toBe('45%');
  });

  it('shows a weak spot with its warning label', () => {
    renderHex({ ...base, status: 'weak', mastery: 38 });
    const hex = screen.getByRole('link', { name: 'Surds, weak, 38% mastered' });
    expect(hex).toHaveClass('hex--weak');
    expect(hex).toHaveTextContent('WEAK · 38%');
  });

  it('shows a locked topic as a button that explains how to unlock it', async () => {
    const onLocked = renderHex({ ...base, status: 'locked', mastery: 0 });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Surds, locked' }));
    expect(onLocked).toHaveBeenCalledWith('Finish the topics before Surds to unlock it.');
  });
});

describe('ChallengeHex', () => {
  it('shows a locked unit challenge with its unlock target', async () => {
    const onLocked = vi.fn();
    render(
      <MemoryRouter>
        <ChallengeHex
          unitTitle="Number"
          challenge={{ lessonId: 'number-challenge', unlockAtPercent: 80, unlocked: false }}
          onLocked={onLocked}
        />
      </MemoryRouter>,
    );
    const hex = screen.getByRole('button', {
      name: 'Challenge, unlocks at 80% mastered in Number',
    });
    expect(hex).toHaveTextContent('Unlocks at 80%');
    await userEvent.click(hex);
    expect(onLocked).toHaveBeenCalledWith('Reach 80% mastery in Number to unlock the challenge.');
  });

  it('links to an unlocked unit challenge', () => {
    render(
      <MemoryRouter>
        <ChallengeHex
          unitTitle="Number"
          challenge={{ lessonId: 'number-challenge', unlockAtPercent: 80, unlocked: true }}
          onLocked={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Challenge, Number' })).toHaveAttribute(
      'href',
      '/learn/topic/number-challenge',
    );
  });
});

describe('hex names', () => {
  it.each(['mastered', 'in-progress', 'weak', 'locked'] as const)(
    'a %s topic is named starting with the words on it, for voice control',
    (status) => {
      renderHex({ ...base, status, mastery: status === 'mastered' ? 100 : 38 });
      const hex = screen.getByRole(status === 'locked' ? 'button' : 'link');
      expect(hex.getAttribute('aria-label')).toMatch(/^Surds, /);
      expect(nameStartsWithText(hex)).toBe(true);
    },
  );

  it.each([true, false])(
    'a challenge (unlocked: %s) is named starting with its words',
    (unlocked) => {
      render(
        <MemoryRouter>
          <ChallengeHex
            unitTitle="Number"
            challenge={{ lessonId: 'number-challenge', unlockAtPercent: 80, unlocked }}
            onLocked={() => {}}
          />
        </MemoryRouter>,
      );
      expect(nameStartsWithText(screen.getByRole(unlocked ? 'link' : 'button'))).toBe(true);
    },
  );
});
