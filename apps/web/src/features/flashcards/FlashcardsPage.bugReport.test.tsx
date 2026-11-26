import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';

const nextReviewMs = { again: 600_000, hard: 86_400_000, good: 86_400_000, easy: 345_600_000 };
const card = (origin: 'deck' | 'own') => ({
  id: '00000000-0000-4000-8000-000000000451',
  topicId: 'demo-topic-a',
  topicTitle: 'Demo topic A',
  subjectId: 'gcse-maths',
  origin,
  front: 'Bug front',
  back: 'Bug back',
  draft: false,
  dueAt: '2026-11-24T10:00:00.000Z',
  nextReviewMs,
  ...(origin === 'deck' ? { contentId: 'demo-card-0451' } : {}),
});

async function deviceList(origin: 'deck' | 'own') {
  server.use(
    http.get('*/v1/student/flashcards', () =>
      HttpResponse.json({
        due: [card(origin)],
        decks: [],
        mine: [],
        draftContent: false,
        dueToday: 1,
        backlog: 1,
        doneToday: false,
      }),
    ),
  );
  renderRoute('/cards');
  await screen.findByText('Bug front');
  await userEvent.click(screen.getByRole('button', { name: 'Report a bug' }));
  const sheet = screen.getByRole('dialog', { name: 'Report a bug' });
  await userEvent.click(within(sheet).getByRole('checkbox', { name: 'Include device details' }));
  return sheet;
}

describe('a bug report from Cards names the card (F16)', () => {
  it("adds a deck card's content id to the device details", async () => {
    const sheet = await deviceList('deck');
    expect(within(sheet).getByText('Question or card: demo-card-0451')).toBeInTheDocument();
  });

  it("never names a student's own card", async () => {
    const sheet = await deviceList('own');
    expect(within(sheet).queryByText(/Question or card/)).toBeNull();
  });
});
