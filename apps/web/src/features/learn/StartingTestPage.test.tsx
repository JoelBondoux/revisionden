import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { demoItems } from './mocks';

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));

describe('Starting test', () => {
  it('explains the test before it starts', async () => {
    renderRoute('/learn/subject/gcse-maths/start');
    expect(screen.getByRole('heading', { level: 1, name: 'Starting test' })).toBeInTheDocument();
    expect(screen.getByText(/about 5 minutes/)).toBeInTheDocument();
  });

  it('hides feedback during the test and shows mastery at the end', async () => {
    const modes: string[] = [];
    server.use(
      http.post('*/v1/student/learn/attempts', async ({ request }) => {
        const body = (await request.json()) as { mode: string; startingTestId: string };
        modes.push(`${body.mode}:${body.startingTestId}`);
        return HttpResponse.json({
          id: '00000000-0000-4000-8000-000000000500',
          itemId: '00000000-0000-4000-8000-000000000001',
          correct: true,
          score: 1,
          xpEarned: 10,
          createdAt: '2026-11-24T10:00:00.000Z',
          feedback: null,
          progress: {
            xpToday: 40,
            totalXp: 240,
            dailyGoalXp: 50,
            goalMet: false,
            streak: { current: 4, best: 9, skipDays: 1 },
          },
          flashcardAdded: false,
        });
      }),
    );
    renderRoute('/learn/subject/gcse-maths/start');
    await click('Start');
    expect(await screen.findByText(/5:00|4:59/)).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('DRAFT CONTENT');
    await userEvent.click(screen.getByRole('radio', { name: 'Option B' }));
    await click('Next');
    expect(await screen.findByLabelText('Your answer')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Answer feedback' })).not.toBeInTheDocument();
    await click('Skip');
    await userEvent.type(await screen.findByLabelText('Your answer'), '4');
    await click('Finish');
    expect(await screen.findByRole('heading', { name: 'Your starting point' })).toBeInTheDocument();
    expect(screen.getByText('You got 1 of 3 right.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Demo topic A mastery' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
    expect(modes).toEqual([
      'test:00000000-0000-4000-8000-000000000900',
      'test:00000000-0000-4000-8000-000000000900',
    ]);
  });

  it('finishes by itself when the time runs out', async () => {
    server.use(
      http.post('*/v1/student/learn/starting-tests', () =>
        HttpResponse.json(
          {
            id: '00000000-0000-4000-8000-000000000900',
            subjectId: 'gcse-maths',
            timeLimitSeconds: 1,
            items: demoItems.slice(0, 1),
            draftContent: false,
          },
          { status: 201 },
        ),
      ),
    );
    renderRoute('/learn/subject/gcse-maths/start');
    await click('Start');
    expect(
      await screen.findByRole('heading', { name: 'Your starting point' }, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Time is up/)).toBeInTheDocument();
  });

  it('says when a subject has no questions ready', async () => {
    server.use(
      http.post('*/v1/student/learn/starting-tests', () =>
        HttpResponse.json({ error: { code: 'no_content', message: 'x' } }, { status: 404 }),
      ),
    );
    renderRoute('/learn/subject/gcse-maths/start');
    await click('Start');
    expect(await screen.findByText(/No questions are ready/)).toBeInTheDocument();
  });

  it('shows a reference code when the test cannot start', async () => {
    server.use(
      http.post('*/v1/student/learn/starting-tests', () =>
        HttpResponse.json(
          { error: { code: 'internal_error', message: 'Something went wrong', ref: 'RD-7K2M9Q' } },
          { status: 500 },
        ),
      ),
    );
    renderRoute('/learn/subject/gcse-maths/start');
    await click('Start');
    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
    expect(screen.getByText('RD-7K2M9Q')).toBeInTheDocument();
  });
});
