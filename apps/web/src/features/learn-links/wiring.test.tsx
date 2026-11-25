import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import { renderRoute } from '../../test/render';

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
          },
        ],
      ],
    ]),
  };
});

describe('Learn it first on a topic lesson', () => {
  it('shows the button on a topic with a checked link', async () => {
    renderRoute('/learn/topic/demo-topic-a');
    expect(await screen.findByRole('button', { name: 'Learn it first' })).toBeInTheDocument();
  });

  it('hides it on a topic whose links are not checked yet', async () => {
    renderRoute('/learn/topic/demo-topic-b');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Learn it first' })).not.toBeInTheDocument();
  });
});
