import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { server } from '../../mocks/server';
import { StudentProvider } from '../../session/StudentContext';
import { LessonPlayer } from './LessonPlayer';
import { demoItems, demoSimilar } from './mocks';
import type { AnswerReactionEvent } from './reaction';

const short = demoItems[1]!;
const worked = demoItems[3]!;

function play(
  items = [short, short],
  onAnswerReaction = vi.fn<(e: AnswerReactionEvent) => void>(),
) {
  const storage = new Map([['revisionden.studentId', 'student-1']]);
  render(
    <StudentProvider
      storage={{
        getItem: (k) => storage.get(k) ?? null,
        setItem: (k, v) => void storage.set(k, v),
      }}
    >
      <MemoryRouter>
        <LessonPlayer
          title="Demo lesson"
          items={items}
          draftContent={false}
          onAnswerReaction={onAnswerReaction}
        />
      </MemoryRouter>
    </StudentProvider>,
  );
  return onAnswerReaction;
}

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));
async function answer(text: string) {
  await userEvent.type(await screen.findByLabelText('Your answer'), text);
  await click('Check');
  await screen.findByRole('status', { name: 'Answer feedback' });
}

describe('lesson reactions for Pip and the avatar (F13, for J14)', () => {
  it('reports a right answer with the combo, then a wrong one', async () => {
    const onReaction = play([short, demoSimilar]);
    await answer('demo answer');
    expect(onReaction).toHaveBeenLastCalledWith({ kind: 'right', combo: 1 });
    await click('Continue');
    await answer('not it');
    expect(onReaction).toHaveBeenLastCalledWith({ kind: 'wrong', combo: 0 });
    expect(onReaction).toHaveBeenCalledTimes(2);
  });

  it('says nothing for an answer that could not be marked (F12)', async () => {
    server.use(
      http.post('*/v1/student/learn/attempts', () =>
        HttpResponse.json({ unmarked: true, itemId: worked.id }),
      ),
    );
    const onReaction = play([worked, short]);
    await userEvent.type(await screen.findByLabelText('Your working (one step per line)'), 'x = 2');
    await click('Check');
    await screen.findByText(/so this one's skipped/);
    expect(onReaction).not.toHaveBeenCalled();
  });
});
