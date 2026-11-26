import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { demoItems, demoSimilar } from './mocks';

const short = demoItems[1]!;
const lesson = (...list: unknown[]) =>
  server.use(
    http.get('*/v1/student/learn/lesson', () =>
      HttpResponse.json({ items: list, draftContent: true }),
    ),
  );
const helpSteps = (steps: string[]) =>
  server.use(
    http.get(`*/v1/student/learn/items/${short.id}/help`, () => HttpResponse.json({ steps })),
  );
function attemptBodies() {
  const bodies: { helped?: boolean }[] = [];
  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'POST' && request.url.endsWith('/learn/attempts')) {
      bodies.push((await request.clone().json()) as { helped?: boolean });
    }
  });
  return bodies;
}
const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));
async function answerRight() {
  await userEvent.type(await screen.findByLabelText('Your answer'), 'demo answer');
  await click('Check');
}

afterEach(() => server.events.removeAllListeners());

describe('Need a clue? then Help me understand (F10)', () => {
  it('shows the clue on request, not up front, with no penalty', async () => {
    const bodies = attemptBodies();
    lesson({ ...short, hint: 'Demo clue', canHelp: true });
    renderRoute('/learn/topic/demo-topic-a');
    await screen.findByLabelText('Your answer');
    expect(screen.queryByText(/Demo clue/)).not.toBeInTheDocument();
    await click('Need a clue?');
    expect(screen.getByText('Demo clue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help me understand' })).toBeInTheDocument();
    await answerRight();
    expect(await screen.findByRole('status', { name: 'Answer feedback' })).toHaveTextContent(
      'Correct!',
    );
    expect(bodies[0]!.helped).toBeUndefined();
  });

  it('then steps through the verified solution, and the answer counts as helped', async () => {
    const bodies = attemptBodies();
    lesson({ ...short, hint: 'Demo clue', canHelp: true });
    helpSteps(['Demo help one', 'Demo help two', 'Answer: demo answer']);
    renderRoute('/learn/topic/demo-topic-a');
    await screen.findByLabelText('Your answer');
    await click('Need a clue?');
    await click('Help me understand');
    const panel = await screen.findByRole('region', { name: 'Help me understand' });
    expect(within(panel).getByText('Step 1 of 3')).toBeInTheDocument();
    expect(within(panel).getByText('Demo help one')).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Next step' }));
    expect(within(panel).getByText('Demo help two')).toBeInTheDocument();
    // The answer box and Check stay on screen: they still have to answer.
    expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument();
    await answerRight();
    const feedback = await screen.findByRole('status', { name: 'Answer feedback' });
    expect(feedback).toHaveTextContent('Correct, with help');
    expect(feedback).toHaveTextContent(/come back to practise/);
    expect(bodies[0]!.helped).toBe(true);
  });

  it('raises powers in the clue and the help steps, like the question (F9)', async () => {
    lesson({ ...short, hint: 'Demo clue x^2', canHelp: true });
    helpSteps(['Demo step 10^3', 'Answer: demo answer']);
    renderRoute('/learn/topic/demo-topic-a');
    await screen.findByLabelText('Your answer');
    await click('Need a clue?');
    const clue = screen.getByText(/Clue:/).closest('p')!;
    expect(clue.querySelector('sup')).toHaveTextContent('2');
    expect(clue).toHaveTextContent('x squared');
    await click('Help me understand');
    const panel = await screen.findByRole('region', { name: 'Help me understand' });
    expect(panel.querySelector('sup')).toHaveTextContent('3');
  });

  it('ignores help that arrives after the pupil has moved on to the next question', async () => {
    const bodies = attemptBodies();
    const next = { ...demoSimilar, prompt: 'Demo next' };
    lesson({ ...short, canHelp: true }, { ...next, canHelp: true });
    let release!: () => void;
    const slow = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get(`*/v1/student/learn/items/${short.id}/help`, async () => {
        await slow;
        return HttpResponse.json({ steps: ['Late step', 'Answer: demo answer'] });
      }),
    );
    renderRoute('/learn/topic/demo-topic-a');
    await screen.findByLabelText('Your answer');
    await click('Help me understand');
    // The pupil answers and moves on before the help arrives.
    await answerRight();
    await click('Continue');
    await screen.findByText('Demo next');
    release();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('region', { name: 'Help me understand' })).toBeNull();
    await answerRight();
    await screen.findByRole('status', { name: 'Answer feedback' });
    expect(bodies[1]!.helped).toBeUndefined();
  });

  it('goes straight to Help me understand when there is no clue', async () => {
    lesson({ ...short, canHelp: true });
    renderRoute('/learn/topic/demo-topic-a');
    await screen.findByLabelText('Your answer');
    expect(screen.queryByRole('button', { name: 'Need a clue?' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help me understand' })).toBeInTheDocument();
  });

  it('offers no help when the item has no verified clue or steps', async () => {
    lesson({ ...short });
    renderRoute('/learn/topic/demo-topic-a');
    await screen.findByLabelText('Your answer');
    expect(screen.queryByRole('button', { name: /clue|Help me understand/ })).toBeNull();
  });
});
