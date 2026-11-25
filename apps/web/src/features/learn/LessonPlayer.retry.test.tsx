import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { demoEasier, demoItems, demoSimilar, mockHelp, mockNextShaky, mockSimilar } from './mocks';

const lesson = (...list: unknown[]) =>
  server.use(
    http.get('*/v1/student/learn/lesson', () =>
      HttpResponse.json({ items: list, draftContent: true }),
    ),
  );
const only = (...indexes: number[]) => lesson(...indexes.map((i) => demoItems[i]));

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));
const feedback = () => screen.findByRole('status', { name: 'Answer feedback' });
const progressMax = () =>
  screen.getByRole('progressbar', { name: 'Lesson progress' }).getAttribute('aria-valuemax');

async function wrongShortAnswer() {
  await userEvent.type(await screen.findByLabelText('Your answer'), 'nope');
  await click('Check');
}
async function rightShortAnswer() {
  await userEvent.type(await screen.findByLabelText('Your answer'), 'demo answer');
  await click('Check');
}
async function rightChoice() {
  await userEvent.click(await screen.findByRole('radio', { name: 'Option B' }));
  await click('Check');
}

beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0));
afterEach(() => vi.restoreAllMocks());

describe('Learning from mistakes in a lesson', () => {
  it('brings a similar question back 2 questions after a wrong answer', async () => {
    only(1, 0, 2, 3);
    mockSimilar(demoItems[1]!.id, demoSimilar);
    renderRoute('/learn/topic/demo-topic-a');
    await wrongShortAnswer();
    expect(await feedback()).toHaveTextContent(/another go at this in a moment/);
    expect(progressMax()).toBe('5');
    await click('Continue');
    await rightChoice();
    await click('Continue');
    await userEvent.type(await screen.findByLabelText('Your answer'), '4');
    await click('Check');
    await click('Continue');
    expect(await screen.findByText(demoSimilar.prompt)).toBeInTheDocument();
    expect(screen.getByText(/another one like it. You've got this/)).toBeInTheDocument();
  });

  it('brings the same question back at the end, as a retry, and celebrates a comeback', async () => {
    const bodies: { retry?: boolean }[] = [];
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'POST' && request.url.endsWith('/learn/attempts')) {
        bodies.push((await request.clone().json()) as { retry?: boolean });
      }
    });
    only(1, 0);
    renderRoute('/learn/topic/demo-topic-a');
    await wrongShortAnswer();
    await click('Continue');
    await rightChoice();
    await click('Continue');
    expect(await screen.findByText("Another go at this one: you've got this.")).toBeInTheDocument();
    await rightShortAnswer();
    expect(await feedback()).toHaveTextContent('Comeback! You got it this time.');
    await click('Finish');
    expect(await screen.findByRole('region', { name: 'Lesson complete' })).toBeInTheDocument();
    expect(bodies.map((b) => b.retry ?? false)).toEqual([false, false, true]);
    server.events.removeAllListeners();
  });

  it('steps down to an easier question after a second miss, instead of repeating', async () => {
    only(1);
    mockHelp(demoItems[1]!.id, { easier: demoEasier });
    renderRoute('/learn/topic/demo-topic-a');
    await wrongShortAnswer();
    await click('Continue');
    await wrongShortAnswer();
    expect(await feedback()).toHaveTextContent(
      /tricky today, so we'll come back to it another day/,
    );
    await click('Continue');
    expect(await screen.findByText("Let's try an easier one on this.")).toBeInTheDocument();
    expect(screen.getByText(demoEasier.prompt)).toBeInTheDocument();
    expect(progressMax()).toBe('3');
  });

  it('puts a question they know before a retry, and ends on a success', async () => {
    only(1);
    mockHelp(demoItems[1]!.id, { confidence: demoItems[2] });
    renderRoute('/learn/topic/demo-topic-a');
    await wrongShortAnswer();
    await click('Continue');
    expect(await screen.findByText('A quick one you know.')).toBeInTheDocument();
    await userEvent.type(await screen.findByLabelText('Your answer'), '4');
    await click('Check');
    await click('Continue');
    expect(await screen.findByText("Another go at this one: you've got this.")).toBeInTheDocument();
    await wrongShortAnswer();
    // The last answer was wrong, so one more question they know comes before the summary.
    await click('Continue');
    expect(await screen.findByText('A quick one you know.')).toBeInTheDocument();
    await userEvent.type(await screen.findByLabelText('Your answer'), '4');
    await click('Check');
    await click('Finish');
    expect(await screen.findByRole('region', { name: 'Lesson complete' })).toBeInTheDocument();
  });

  it('lets you skip a question that came back', async () => {
    only(1);
    renderRoute('/learn/topic/demo-topic-a');
    await wrongShortAnswer();
    await click('Continue');
    expect(await screen.findByText("Another go at this one: you've got this.")).toBeInTheDocument();
    await click('Skip this one');
    expect(await screen.findByRole('region', { name: 'Lesson complete' })).toBeInTheDocument();
  });

  it('says a slow right answer will come back another day', async () => {
    only(1);
    mockNextShaky();
    renderRoute('/learn/topic/demo-topic-a');
    await rightShortAnswer();
    expect(await feedback()).toHaveTextContent(/come back another day/);
  });

  it('labels warm-up questions', async () => {
    lesson({ ...demoItems[0], warmUp: true }, demoItems[1]);
    renderRoute('/learn/topic/demo-topic-a');
    expect(await screen.findByText(/Warm-up: this one came up last time/)).toBeInTheDocument();
  });
});
