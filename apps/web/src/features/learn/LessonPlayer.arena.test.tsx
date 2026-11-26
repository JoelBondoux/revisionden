import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { stubReducedMotion } from '../juice/testing';
import { demoItems } from './mocks';

const only = (...indexes: number[]) =>
  server.use(
    http.get('*/v1/student/learn/lesson', () =>
      HttpResponse.json({ items: indexes.map((i) => demoItems[i]), draftContent: false }),
    ),
  );

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));
const feedback = () => screen.findByRole('status', { name: 'Answer feedback' });
const optionLabel = (name: string) => screen.getByRole('radio', { name }).closest('label')!;

async function answerText(text: string) {
  await userEvent.type(await screen.findByLabelText('Your answer'), text);
  await click('Check');
  await feedback();
}

afterEach(() => vi.unstubAllGlobals());

describe('Lesson player in the arena (game feel)', () => {
  beforeEach(() => stubReducedMotion(false));

  it('plays on the dark arena with chunky 2 × 2 answer buttons', async () => {
    only(0);
    const { container } = renderRoute('/learn/topic/demo-topic-a');
    await screen.findByRole('group', { name: 'Demo question 1' });
    expect(container.querySelector('.arena')).not.toBeNull();
    const grid = container.querySelector('.answer-grid')!;
    expect(grid.querySelectorAll('.answer-option')).toHaveLength(3);
  });

  it('keeps the question and its answers together on one calm stage, whatever the style', async () => {
    only(0);
    const { container } = renderRoute('/learn/topic/demo-topic-a');
    const question = await screen.findByRole('group', { name: 'Demo question 1' });
    const stage = container.querySelector('.lesson__stage')!;
    expect(stage).toContainElement(question);
    expect(stage.querySelector('.pip-says, .combo-badge')).toBeNull();
  });

  it('celebrates a right answer: green option, particle burst and +XP floating up', async () => {
    only(0, 1);
    const { container } = renderRoute('/learn/topic/demo-topic-a');
    await userEvent.click(await screen.findByRole('radio', { name: 'Option B' }));
    await click('Check');
    await feedback();
    const chosen = optionLabel('Option B');
    expect(chosen).toHaveClass('answer-option--right');
    expect(chosen.querySelector('.burst')).not.toBeNull();
    // J10g: "+XP" pops just above the feedback, never across the question.
    const floater = container.querySelector('.float-up')!;
    expect(floater).toHaveTextContent('+10 XP');
    expect(container.querySelector('.lesson__footer')).toContainElement(floater as HTMLElement);
    expect(container.querySelector('.lesson__stage')!.querySelector('.float-up')).toBeNull();
    expect(screen.getByText('XP this lesson: 10 XP')).toBeInTheDocument();
  });

  it('after a wrong answer, shakes gently and shows the right option, with no fail words', async () => {
    only(0, 1);
    const { container } = renderRoute('/learn/topic/demo-topic-a');
    await userEvent.click(await screen.findByRole('radio', { name: 'Option A' }));
    await click('Check');
    const box = await feedback();
    expect(container.querySelector('.shake')).not.toBeNull();
    expect(optionLabel('Option B')).toHaveClass('answer-option--right');
    expect(optionLabel('Option A')).not.toHaveClass('answer-option--right');
    expect(container.querySelector('.burst')).toBeNull();
    expect(box).not.toHaveTextContent(/fail|lose|lost/i);
  });

  it('shows COMBO ×2 from 2 right in a row and quietly resets it on a wrong answer', async () => {
    only(1, 2, 1);
    renderRoute('/learn/topic/demo-topic-a');
    await answerText('demo answer');
    expect(screen.queryByText(/COMBO/)).not.toBeInTheDocument();
    await click('Continue');
    await answerText('4');
    expect(screen.getByText('COMBO ×2')).toBeInTheDocument();
    await click('Continue');
    await answerText('nope');
    expect(screen.queryByText(/COMBO/)).not.toBeInTheDocument();
  });

  it('has Pip warm up on the first question and call out the last one', async () => {
    only(1, 2);
    renderRoute('/learn/topic/demo-topic-a');
    expect(await screen.findByText(/warm-up/i)).toBeInTheDocument();
    await answerText('demo answer');
    await click('Continue');
    expect(await screen.findByText(/last one/i)).toBeInTheDocument();
  });

  it('uses a glowing progress bar that moves on as each answer is marked', async () => {
    only(1, 2);
    renderRoute('/learn/topic/demo-topic-a');
    const bar = await screen.findByRole('progressbar', { name: 'Lesson progress' });
    expect(bar).toHaveClass('arena-progress');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    await answerText('demo answer');
    expect(bar).toHaveAttribute('aria-valuenow', '1');
  });

  it('ends with a set complete celebration: stars, best combo, confetti and Next mission', async () => {
    only(1, 2);
    const { container } = renderRoute('/learn/topic/demo-topic-a');
    await answerText('demo answer');
    await click('Continue');
    await answerText('4');
    await click('Finish');
    const summary = await screen.findByRole('region', { name: 'Lesson complete' });
    expect(within(summary).getByRole('img', { name: '3 of 3 stars' })).toBeInTheDocument();
    expect(within(summary).getByText('Best combo')).toBeInTheDocument();
    expect(within(summary).getByText('×2')).toBeInTheDocument();
    expect(container.querySelector('.confetti')).not.toBeNull();
    const next = within(summary).getByRole('link', { name: 'Next mission' });
    expect(next).toHaveAttribute('href', '/map');
    expect(next).toHaveClass('cta-pulse');
    // 30 XP before, +30 now: the daily goal (50) is met, so the streak is safe.
    expect(within(summary).getByText('Or take a break. Your streak is safe for today.'));
  });

  it('does not say the streak is safe before the daily goal is met', async () => {
    only(0);
    renderRoute('/learn/topic/demo-topic-a');
    await userEvent.click(await screen.findByRole('radio', { name: 'Option B' }));
    await click('Check');
    await click('Finish');
    await screen.findByRole('region', { name: 'Lesson complete' });
    expect(screen.queryByText(/streak is safe/)).not.toBeInTheDocument();
  });
});

describe('Flashcards inside a lesson', () => {
  beforeEach(() => stubReducedMotion(false));

  it('keeps the revealed answer on screen after saying whether you knew it', async () => {
    only(4);
    renderRoute('/learn/topic/demo-topic-a');
    await userEvent.click(await screen.findByRole('button', { name: 'Show answer' }));
    await click('I knew it');
    await feedback();
    expect(screen.getByText('Demo back 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show answer' })).not.toBeInTheDocument();
  });

  it('still shakes after a "Not yet"', async () => {
    only(4);
    const { container } = renderRoute('/learn/topic/demo-topic-a');
    await userEvent.click(await screen.findByRole('button', { name: 'Show answer' }));
    await click('Not yet');
    await feedback();
    expect(container.querySelector('.shake')).not.toBeNull();
    expect(screen.getByText('Demo back 1')).toBeInTheDocument();
  });
});

describe('Combo bonus from the API (J4)', () => {
  beforeEach(() => stubReducedMotion(false));

  it('shows the combo bonus in the feedback and follows the server combo', async () => {
    only(1);
    server.use(
      http.post('*/v1/student/learn/attempts', () =>
        HttpResponse.json({
          id: '00000000-0000-4000-8000-000000000500',
          itemId: demoItems[1]!.id,
          correct: true,
          score: 1,
          xpEarned: 20,
          createdAt: '2026-11-24T10:00:00.000Z',
          feedback: { correctAnswer: 'demo answer' },
          progress: {
            xpToday: 50,
            totalXp: 250,
            dailyGoalXp: 50,
            goalMet: true,
            streak: { current: 4, best: 4, skipDays: 0 },
          },
          flashcardAdded: false,
          newlyEarned: [],
          combo: 3,
          comboBonusXp: 5,
        }),
      ),
    );
    renderRoute('/learn/topic/demo-topic-a');
    await answerText('demo answer');
    expect(await feedback()).toHaveTextContent('Includes +5 XP combo bonus');
    expect(screen.getByText('COMBO ×3')).toBeInTheDocument();
  });
});

describe('Lesson player with reduced motion', () => {
  beforeEach(() => stubReducedMotion(true));

  it('keeps colour and text but drops particles, float-ups, shakes and confetti', async () => {
    only(0, 0);
    const { container } = renderRoute('/learn/topic/demo-topic-a');
    await userEvent.click(await screen.findByRole('radio', { name: 'Option B' }));
    await click('Check');
    expect(await feedback()).toHaveTextContent('+10 XP');
    expect(optionLabel('Option B')).toHaveClass('answer-option--right');
    expect(container.querySelector('.burst')).toBeNull();
    expect(container.querySelector('.float-up')).toBeNull();
    await click('Continue');
    await userEvent.click(await screen.findByRole('radio', { name: 'Option A' }));
    await click('Check');
    await feedback();
    expect(container.querySelector('.shake')).toBeNull();
    // The missed question comes back at the end (F5); skip it to finish.
    await click('Continue');
    await click('Skip this one');
    await screen.findByRole('region', { name: 'Lesson complete' });
    expect(container.querySelector('.confetti')).toBeNull();
  });
});
