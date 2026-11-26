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
            title: 'Demo question lesson',
            url: 'https://www.thenational.academy/teachers/demo-question',
            provider: 'oak',
            level: 'GCSE',
            items: ['demo-content-1'],
            checked_at: '2026-11-25',
            match,
          },
          {
            title: 'Demo card point lesson',
            url: 'https://www.thenational.academy/teachers/demo-card-point',
            provider: 'oak',
            level: 'GCSE',
            learning_points: ['demo-topic-a-lp-card'],
            checked_at: '2026-11-25',
            match,
          },
          {
            title: 'Demo point lesson',
            url: 'https://www.thenational.academy/teachers/demo-point',
            provider: 'oak',
            level: 'GCSE',
            learning_points: ['demo-topic-a-lp-demo'],
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
            // Reachable but with no match check: never shown.
            title: 'Reachable but not match-checked',
            url: 'https://www.thenational.academy/teachers/unmatched',
            provider: 'oak',
            level: 'GCSE',
            items: ['demo-item'],
            checked_at: '2026-11-25',
          },
        ],
      ],
    ]),
  };
});

// Demo question 1, tagged with a learning point that has its own lesson.
const lessonOf = (index: number) =>
  server.use(
    http.get('*/v1/student/learn/lesson', () =>
      HttpResponse.json({
        items: [{ ...demoItems[index], learningPoint: 'demo-topic-a-lp-demo' }],
        draftContent: true,
      }),
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
  it("offers the lessons for the question's learning point, tucked behind a tap", async () => {
    lessonOf(0);
    renderRoute('/learn/topic/demo-topic-a');
    const feedback = await answer('Option A');
    const button = within(feedback).getByRole('button', { name: 'Learn more' });
    expect(within(feedback).queryByRole('link')).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(within(feedback).getByRole('link', { name: /Demo point lesson/ })).toHaveAttribute(
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

describe('Learn more for the exact question (Q6b)', () => {
  it("offers the item's own lesson ahead of its learning point's", async () => {
    server.use(
      http.get('*/v1/student/learn/lesson', () =>
        HttpResponse.json({
          items: [
            { ...demoItems[0], learningPoint: 'demo-topic-a-lp-demo', contentId: 'demo-content-1' },
          ],
          draftContent: true,
        }),
      ),
    );
    renderRoute('/learn/topic/demo-topic-a');
    const feedback = await answer('Option A');
    await userEvent.click(within(feedback).getByRole('button', { name: 'Learn more' }));
    expect(
      within(feedback).getByRole('link', { name: /Demo question lesson/ }),
    ).toBeInTheDocument();
    expect(within(feedback).queryByRole('link', { name: /Demo point lesson/ })).toBeNull();
  });
});

const taggedCard = {
  id: '00000000-0000-4000-8000-000000000c01',
  topicId: 'demo-topic-a',
  topicTitle: 'Demo topic A',
  subjectId: 'gcse-maths',
  origin: 'deck',
  front: 'Tagged front',
  back: 'Tagged back',
  draft: true,
  dueAt: '2026-11-26T09:00:00.000Z',
  nextReviewMs: { again: 60000, hard: 86400000, good: 86400000, easy: 345600000 },
  explain: ['Tagged step', 'Answer: Tagged back'],
  learningPoint: 'demo-topic-a-lp-card',
};

describe('Learn more on a flashcard Explain', () => {
  it("offers the card's learning point lessons when the card has one (Q6b)", async () => {
    server.use(
      http.get('*/v1/student/flashcards', () =>
        HttpResponse.json({
          due: [taggedCard],
          decks: [
            {
              topicId: 'demo-topic-a',
              title: 'Demo topic A',
              subjectId: 'gcse-maths',
              total: 1,
              due: 1,
            },
          ],
          mine: [],
          draftContent: true,
        }),
      ),
    );
    renderRoute('/cards');
    await screen.findByText('Tagged front', {}, WAIT);
    await userEvent.click(screen.getByRole('button', { name: 'Show answer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Explain' }));
    const panel = screen.getByRole('region', { name: 'Explain' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Learn more' }));
    expect(within(panel).getByRole('link', { name: /Demo card point lesson/ })).toBeInTheDocument();
    expect(within(panel).queryByRole('link', { name: /^Demo lesson/ })).toBeNull();
  });

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
