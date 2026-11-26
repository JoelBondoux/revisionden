import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { demoItems } from './mocks';

const worked = demoItems[3]!;
const short = demoItems[1]!;
const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));

describe('typed working that cannot be marked right now (F12)', () => {
  it('says it is skipped with no XP lost, and Continue moves on', async () => {
    server.use(
      http.get('*/v1/student/learn/lesson', () =>
        HttpResponse.json({ items: [worked, short], draftContent: false }),
      ),
      http.post('*/v1/student/learn/attempts', () =>
        HttpResponse.json({ unmarked: true, itemId: worked.id }),
      ),
    );
    renderRoute('/learn/topic/demo-topic-b');
    await userEvent.type(await screen.findByLabelText('Your working (one step per line)'), 'x = 2');
    await click('Check');
    expect(
      await screen.findByText(
        "We can't mark typed working right now, so this one's skipped. No XP lost.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Couldn.t check that answer/)).toBeNull();
    expect(screen.queryByText(/Not quite/)).toBeNull();
    await click('Continue');
    expect(await screen.findByLabelText('Your answer')).toBeInTheDocument();
    expect(screen.queryByText(/so this one's skipped/)).toBeNull();
  });
});
