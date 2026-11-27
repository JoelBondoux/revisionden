import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { demoItems, mockNextRewards } from './mocks';

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));

describe('Starting test', () => {
  it('explains the test before it starts', async () => {
    renderRoute('/learn/subject/gcse-maths/start');
    expect(screen.getByRole('heading', { level: 1, name: 'Starting test' })).toBeInTheDocument();
    expect(screen.getByText(/about 5 minutes/)).toBeInTheDocument();
    expect(screen.getByText(/tap More time in the last minute/)).toBeInTheDocument();
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
          newlyEarned: [],
        });
      }),
    );
    renderRoute('/learn/subject/gcse-maths/start');
    await click('Start');
    expect(await screen.findByText(/5:00|4:59/)).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(
      'Draft content: not checked yet. For testing only.',
    );
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

  it('saves rewards earned during the test for the end, so it stays quiet', async () => {
    mockNextRewards([{ id: 'correct-100', name: '100 right answers', rarity: 'common' }]);
    renderRoute('/learn/subject/gcse-maths/start');
    await click('Start');
    await userEvent.click(await screen.findByRole('radio', { name: 'Option B' }));
    await click('Next');
    expect(screen.queryByRole('status', { name: 'New rewards' })).not.toBeInTheDocument();
    await click('Skip');
    await click('Skip');
    expect(await screen.findByRole('status', { name: 'New rewards' })).toHaveTextContent(
      'New reward: 100 right answers',
    );
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
    const announcer = await screen.findByTestId('timer-announcer');
    expect(
      await screen.findByRole('heading', { name: 'Your starting point' }, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Time is up, so we marked/)).toBeInTheDocument();
    // F14b: the same live region stays on screen from the test to the results, so screen readers
    // hear "Time is up." even when the results come back at once.
    expect(screen.getByTestId('timer-announcer')).toBe(announcer);
    expect(announcer).toHaveTextContent('Time is up.');
  });

  it('tells screen readers once when one minute is left, without reading every second (F14)', async () => {
    server.use(
      http.post('*/v1/student/learn/starting-tests', () =>
        HttpResponse.json(
          {
            id: '00000000-0000-4000-8000-000000000901',
            subjectId: 'gcse-maths',
            timeLimitSeconds: 61,
            items: demoItems.slice(0, 1),
            draftContent: false,
          },
          { status: 201 },
        ),
      ),
    );
    renderRoute('/learn/subject/gcse-maths/start');
    await click('Start');
    const announcer = await screen.findByTestId('timer-announcer');
    expect(announcer).toHaveAttribute('aria-live', 'polite');
    expect(announcer).toHaveTextContent('');
    await waitFor(() => expect(announcer).toHaveTextContent('One minute left.'), {
      timeout: 3000,
    });
    // The visible clock never announces itself.
    expect(document.querySelector('.timer')).toHaveAttribute('aria-live', 'off');
  });

  describe('More time (F17, WCAG 2.2.1: a pupil can extend the limit)', () => {
    const startTest = (timeLimitSeconds: number) =>
      server.use(
        http.post('*/v1/student/learn/starting-tests', () =>
          HttpResponse.json(
            {
              id: '00000000-0000-4000-8000-000000000902',
              subjectId: 'gcse-maths',
              timeLimitSeconds,
              items: demoItems.slice(0, 1),
              draftContent: false,
            },
            { status: 201 },
          ),
        ),
      );

    afterEach(() => vi.restoreAllMocks());

    it('is not offered while more than a minute is left', async () => {
      startTest(300);
      renderRoute('/learn/subject/gcse-maths/start');
      await click('Start');
      expect(await screen.findByText(/5:00|4:59/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'More time' })).not.toBeInTheDocument();
    });

    it('adds two minutes in the last minute and tells screen readers', async () => {
      startTest(60);
      renderRoute('/learn/subject/gcse-maths/start');
      await click('Start');
      await userEvent.click(await screen.findByRole('button', { name: 'More time' }));
      expect(await screen.findByText(/^(3:00|2:59|2:58) left$/)).toBeInTheDocument();
      expect(screen.getByTestId('timer-announcer')).toHaveTextContent('2 more minutes added.');
      expect(screen.queryByRole('button', { name: 'More time' })).not.toBeInTheDocument();
      expect(document.querySelector('.timer')).not.toHaveClass('timer--warning');
    });

    it('can be used ten times, then the limit stands', async () => {
      const realNow = Date.now.bind(Date);
      let offsetMs = 0;
      vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offsetMs);
      startTest(60);
      renderRoute('/learn/subject/gcse-maths/start');
      await click('Start');
      for (let use = 1; use <= 10; use += 1) {
        await userEvent.click(await screen.findByRole('button', { name: 'More time' }));
        offsetMs += 120_000; // the two added minutes pass
        await screen.findByText(/^(1:00|0:59|0:58) left$/);
      }
      // Into the last minute again, after ten uses: no more time is offered.
      await waitFor(() => expect(document.querySelector('.timer')).toHaveClass('timer--warning'));
      expect(screen.queryByRole('button', { name: 'More time' })).not.toBeInTheDocument();
    });
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
