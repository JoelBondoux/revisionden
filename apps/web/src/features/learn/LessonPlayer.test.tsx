import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { demoItems, mockNextRewards } from './mocks';

const only = (...indexes: number[]) =>
  server.use(
    http.get('*/v1/student/learn/lesson', () =>
      HttpResponse.json({ items: indexes.map((i) => demoItems[i]), draftContent: true }),
    ),
  );

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));
const feedback = () => screen.findByRole('status', { name: 'Answer feedback' });

describe('Lesson player', () => {
  it('shows a DRAFT CONTENT banner when the lesson has drafts', async () => {
    only(0);
    renderRoute('/learn/topic/demo-topic-a');
    expect(await screen.findByRole('note')).toHaveTextContent('DRAFT CONTENT');
  });

  it('shows no banner when everything is verified', async () => {
    server.use(
      http.get('*/v1/student/learn/lesson', () =>
        HttpResponse.json({ items: [{ ...demoItems[0], draft: false }], draftContent: false }),
      ),
    );
    renderRoute('/learn/topic/demo-topic-a');
    await screen.findByRole('group', { name: 'Demo question 1' });
    expect(screen.queryByText(/DRAFT CONTENT/)).not.toBeInTheDocument();
  });

  it('gives instant feedback and XP on a right multiple choice answer', async () => {
    only(0, 1);
    renderRoute('/learn/topic/demo-topic-a');
    expect(await screen.findByRole('button', { name: 'Check' })).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'Option B' }));
    await click('Check');
    const box = await feedback();
    expect(box).toHaveTextContent('Correct!');
    expect(box).toHaveTextContent('+10 XP');
    expect(screen.getByRole('progressbar', { name: 'Daily goal' })).toHaveAttribute(
      'aria-valuetext',
      '40 of 50 XP',
    );
  });

  it('announces a reward the answer earned', async () => {
    mockNextRewards([{ id: 'streak-7', name: '7-day streak', rarity: 'common' }]);
    only(0, 1);
    renderRoute('/learn/topic/demo-topic-a');
    await userEvent.click(await screen.findByRole('radio', { name: 'Option B' }));
    await click('Check');
    expect(await screen.findByRole('status', { name: 'New rewards' })).toHaveTextContent(
      'New reward: 7-day streak',
    );
    await click('Continue');
    expect(screen.queryByRole('status', { name: 'New rewards' })).not.toBeInTheDocument();
  });

  it('shows the right answer and that a flashcard was made after a wrong answer', async () => {
    only(1);
    renderRoute('/learn/topic/demo-topic-a');
    await userEvent.type(await screen.findByLabelText('Your answer'), 'nope');
    await click('Check');
    const box = await feedback();
    expect(box).toHaveTextContent('Not quite');
    expect(box).toHaveTextContent('Answer: demo answer');
    expect(box).toHaveTextContent('Demo explanation');
    expect(box).toHaveTextContent('Added to your flashcards');
  });

  it('takes numeric answers with the unit shown', async () => {
    only(2);
    renderRoute('/learn/topic/demo-topic-b');
    expect(await screen.findByText('cm')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Your answer'), '4');
    await click('Check');
    expect(await feedback()).toHaveTextContent('+15 XP');
  });

  it('checks working line by line and points at the first wrong line', async () => {
    only(3);
    renderRoute('/learn/topic/demo-topic-b');
    await userEvent.type(await screen.findByLabelText(/Your working/), 'x + 1 = 4{enter}x = 3');
    await click('Check');
    expect(await feedback()).toHaveTextContent('Line 1 is where it first goes wrong');
  });

  it('lets you flip a flashcard and say whether you knew it', async () => {
    only(4);
    renderRoute('/learn/topic/demo-topic-a');
    expect(await screen.findByText('Demo front 1')).toBeInTheDocument();
    await click('Show answer');
    expect(screen.getByText('Demo back 1')).toBeVisible();
    await click('I knew it');
    expect(await feedback()).toHaveTextContent('+5 XP');
  });

  it('shows long answers with a note that AI marking is coming', async () => {
    only(5);
    renderRoute('/learn/topic/demo-topic-b');
    expect(await screen.findByText(/marked by AI soon/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check' })).not.toBeInTheDocument();
    await click('Finish');
    expect(await screen.findByRole('heading', { name: 'Lesson complete' })).toBeInTheDocument();
  });

  it('ends with a summary of right answers and XP', async () => {
    only(0, 1);
    renderRoute('/learn/topic/demo-topic-a');
    await userEvent.click(await screen.findByRole('radio', { name: 'Option B' }));
    await click('Check');
    await click('Continue');
    await userEvent.type(screen.getByLabelText('Your answer'), 'demo answer');
    await click('Check');
    await click('Finish');
    const summary = await screen.findByRole('region', { name: 'Lesson complete' });
    expect(within(summary).getByText('2 of 2')).toBeInTheDocument();
    expect(within(summary).getByText('+25 XP')).toBeInTheDocument();
  });

  it('says when nothing is ready yet', async () => {
    server.use(
      http.get('*/v1/student/learn/lesson', () =>
        HttpResponse.json({ items: [], draftContent: false }),
      ),
    );
    renderRoute('/learn/topic/demo-topic-a');
    expect(await screen.findByText(/No questions are ready here yet/)).toBeInTheDocument();
  });

  it("offers a topic that's ready instead of a dead end (UX-3)", async () => {
    server.use(
      http.get('*/v1/student/learn/lesson', () =>
        HttpResponse.json({ items: [], draftContent: false }),
      ),
    );
    renderRoute('/learn/topic/demo-topic-a');
    // The map's next suggested topic (mock: Surds).
    expect(await screen.findByRole('link', { name: "Try a topic that's ready" })).toHaveAttribute(
      'href',
      '/learn/topic/surds',
    );
    expect(screen.getByRole('link', { name: 'Back' })).toBeInTheDocument();
  });

  it('only offers Back when no topic is ready either (UX-3)', async () => {
    server.use(
      http.get('*/v1/student/learn/lesson', () =>
        HttpResponse.json({ items: [], draftContent: false }),
      ),
      http.get('*/v1/student/map', () => HttpResponse.error()),
    );
    renderRoute('/learn/topic/demo-topic-a');
    expect(await screen.findByRole('link', { name: 'Back' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: "Try a topic that's ready" }),
    ).not.toBeInTheDocument();
  });

  it('asks you to try again when an answer cannot be checked', async () => {
    only(0);
    server.use(http.post('*/v1/student/learn/attempts', () => HttpResponse.error()));
    renderRoute('/learn/topic/demo-topic-a');
    await userEvent.click(await screen.findByRole('radio', { name: 'Option A' }));
    await click('Check');
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/);
  });

  it('runs a mixed lesson for a subject and the command-word lesson', async () => {
    only(0);
    renderRoute('/learn/subject/gcse-maths/practice');
    expect(await screen.findByRole('group', { name: 'Demo question 1' })).toBeInTheDocument();
  });
});

describe('Command words lesson', () => {
  it('explains what the lesson is for', async () => {
    renderRoute('/learn/command-words');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Command words' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/what each command word asks you to do/)).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: 'Demo question 1' })).toBeInTheDocument();
  });
});

describe('Subject page', () => {
  it('lists topics with mastery and offers the starting test', async () => {
    renderRoute('/learn/subject/gcse-maths');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'GCSE Maths' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Demo topic B mastery' })).toHaveAttribute(
      'aria-valuenow',
      '35',
    );
    expect(screen.getByText('Weak spot')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Take the starting test/ })).toHaveAttribute(
      'href',
      '/learn/subject/gcse-maths/start',
    );
    expect(screen.getByRole('link', { name: 'Demo topic A' })).toHaveAttribute(
      'href',
      '/learn/topic/demo-topic-a',
    );
  });
});
