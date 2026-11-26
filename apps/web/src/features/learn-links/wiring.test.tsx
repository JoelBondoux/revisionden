import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { demoItems } from '../learn/mocks';

const WAIT = { timeout: 5000 };
const { match } = vi.hoisted(() => ({
  match: {
    page_title: 'Demo lesson | Oak National Academy',
    teaches: 'The demo topic, at GCSE.',
    level: 'GCSE',
    checked_at: '2026-11-26',
  },
}));

vi.mock('./links', async (importOriginal) => {
  const real = await importOriginal<typeof import('./links')>();
  const { demoItems: items } = await import('../learn/mocks');
  return {
    ...real,
    learnLinksByTopic: new Map([
      [
        'demo-topic-a',
        [
          {
            title: 'Demo lesson',
            url: 'https://www.thenational.academy/teachers/demo',
            provider: 'oak',
            level: 'GCSE',
            checked_at: '2026-11-25',
            match,
          },
          {
            title: 'Demo question 1 lesson',
            url: 'https://www.thenational.academy/teachers/demo-question-1',
            provider: 'oak',
            level: 'GCSE',
            items: [items[0]!.id],
            checked_at: '2026-11-25',
            match,
          },
        ],
      ],
      [
        'demo-topic-b',
        [
          {
            title: 'Unchecked',
            url: 'https://www.thenational.academy/teachers/other',
            provider: 'oak',
            level: 'GCSE',
            checked_at: null,
            match,
          },
          {
            title: 'Reachable but not match-checked',
            url: 'https://www.thenational.academy/teachers/unmatched',
            provider: 'oak',
            level: 'GCSE',
            checked_at: '2026-11-25',
          },
        ],
      ],
    ]),
  };
});

const lessonOf = (index: number) =>
  server.use(
    http.get('*/v1/student/learn/lesson', () =>
      HttpResponse.json({ items: [demoItems[index]], draftContent: true }),
    ),
  );

async function answer(option: string) {
  await userEvent.click(await screen.findByRole('radio', { name: option }, WAIT));
  await userEvent.click(screen.getByRole('button', { name: 'Check' }));
  return screen.findByRole('status', { name: 'Answer feedback' }, WAIT);
}

describe('Learn it first on a topic lesson', () => {
  it('shows the button on a topic with a checked link', async () => {
    renderRoute('/learn/topic/demo-topic-a');
    expect(await screen.findByRole('button', { name: 'Learn it first' }, WAIT)).toBeInTheDocument();
  });

  it('hides it on a topic whose links are not both reachable and match-checked', async () => {
    renderRoute('/learn/topic/demo-topic-b');
    await screen.findByRole('heading', { level: 1 }, WAIT);
    expect(screen.queryByRole('button', { name: 'Learn it first' })).not.toBeInTheDocument();
  });
});

describe('Learn more after a wrong answer', () => {
  it("offers the question's own lessons, tucked behind a tap", async () => {
    lessonOf(0);
    renderRoute('/learn/topic/demo-topic-a');
    const feedback = await answer('Option A');
    const button = within(feedback).getByRole('button', { name: 'Learn more' });
    expect(within(feedback).queryByRole('link')).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(within(feedback).getByRole('link', { name: /Demo question 1 lesson/ })).toHaveAttribute(
      'target',
      '_blank',
    );
    // The most specific links only: not the whole topic's as well.
    expect(within(feedback).queryByRole('link', { name: /^Demo lesson/ })).not.toBeInTheDocument();
  });

  it('is not offered after a right answer', async () => {
    lessonOf(0);
    renderRoute('/learn/topic/demo-topic-a');
    const feedback = await answer('Option B');
    expect(within(feedback).queryByRole('button', { name: 'Learn more' })).not.toBeInTheDocument();
  });
});

describe('Learn more on a flashcard Explain', () => {
  it("offers the card's topic lessons inside the Explain panel", async () => {
    renderRoute('/cards');
    await screen.findByText('Demo front 1', {}, WAIT);
    await userEvent.click(screen.getByRole('button', { name: 'Show answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Explain' }));
    const panel = screen.getByRole('region', { name: 'Explain' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Learn more' }));
    expect(within(panel).getByRole('link', { name: /^Demo lesson/ })).toHaveAttribute(
      'href',
      'https://www.thenational.academy/teachers/demo',
    );
  });
});
