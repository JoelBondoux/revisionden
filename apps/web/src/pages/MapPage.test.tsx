import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderRoute } from '../test/render';
import { topicMap } from '../mocks/data';

describe('Topic map screen', () => {
  it('sends you to choose a student when nobody is chosen yet', async () => {
    renderRoute('/map', { studentId: null });
    expect(
      await screen.findByRole('heading', { level: 1, name: "Who's revising?" }),
    ).toBeInTheDocument();
  });

  it('still opens from the old /learn address', async () => {
    renderRoute('/learn');
    expect(await screen.findByRole('heading', { level: 1, name: 'Topic map' })).toBeInTheDocument();
  });

  it('shows the subject, streak and daily goal', async () => {
    renderRoute('/map');
    expect(await screen.findByText('GCSE Higher Maths')).toBeInTheDocument();
    expect(screen.getByText('4 day streak')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Daily goal' })).toHaveAttribute(
      'aria-valuetext',
      '30 of 50 XP',
    );
  });

  it('leads with the next mission', async () => {
    renderRoute('/map');
    const mission = await screen.findByRole('region', { name: 'Next mission' });
    expect(mission).toHaveTextContent('Fix weak spot: Surds');
    expect(within(mission).getByRole('link', { name: /go/i })).toHaveAttribute(
      'href',
      '/learn/topic/surds',
    );
  });

  it('groups topics into units, each with its mastery', async () => {
    renderRoute('/map');
    const number = await screen.findByRole('region', { name: 'Number' });
    expect(number).toHaveTextContent('57% mastered');
    expect(screen.getByRole('region', { name: 'Algebra' })).toHaveTextContent('0% mastered');
  });

  it('shows mastered, in-progress, weak-spot and locked topics and the unit challenge', async () => {
    renderRoute('/map');
    const number = await screen.findByRole('region', { name: 'Number' });
    const unit = within(number);
    expect(unit.getByRole('link', { name: 'Fractions, mastered' })).toBeInTheDocument();
    expect(unit.getByRole('link', { name: 'Standard form, 45% mastered' })).toBeInTheDocument();
    expect(unit.getByRole('link', { name: 'Surds, weak spot, 38% mastered' })).toBeInTheDocument();
    expect(unit.getByRole('button', { name: 'Bounds, locked' })).toBeInTheDocument();
    expect(
      unit.getByRole('button', { name: 'Number challenge, unlocks at 80% mastered' }),
    ).toBeInTheDocument();
  });

  it('explains how to unlock a locked topic', async () => {
    renderRoute('/map');
    await userEvent.click(await screen.findByRole('button', { name: 'Bounds, locked' }));
    const message = await screen.findByText('Finish the topics before Bounds to unlock it.');
    expect(message.closest('[role="status"]')).not.toBeNull();
  });

  it('hides the mission card when there is no mission', async () => {
    server.use(
      http.get('*/v1/student/map', async () => {
        const { topicMap } = await import('../mocks/data');
        return HttpResponse.json({ ...topicMap, nextMission: null });
      }),
    );
    renderRoute('/map');
    await screen.findByRole('region', { name: 'Number' });
    expect(screen.queryByRole('region', { name: 'Next mission' })).not.toBeInTheDocument();
  });

  it('offers a retry when the map cannot be loaded', async () => {
    server.use(http.get('*/v1/student/map', () => HttpResponse.error()));
    renderRoute('/map');
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('nudges the student to set any exam board or tier left as Not sure', async () => {
    server.use(
      http.get('*/v1/student/subjects', () =>
        HttpResponse.json({
          enrolments: [
            {
              studentId: '8f6d2b1e-4c3a-4d5e-9f00-000000000001',
              subjectId: 'gcse-maths',
              board: 'not_sure',
              tier: 'higher',
            },
          ],
          toCheckLater: 1,
        }),
      ),
    );
    renderRoute('/map');
    expect(await screen.findByRole('link', { name: /1 thing to check/ })).toHaveAttribute(
      'href',
      '/settings#my-subjects',
    );
  });
});

describe('Topic map for subjects with no questions yet (RD-MBXKTC)', () => {
  const subjects = [
    { subjectId: 'gcse-chemistry', subject: 'Chemistry', hasContent: false },
    { subjectId: 'gcse-maths', subject: 'Maths', hasContent: true },
  ];
  const comingSoon = {
    subjectId: 'gcse-chemistry',
    subject: 'Chemistry',
    qualification: 'GCSE',
    status: 'coming_soon',
    streakDays: 0,
    xpToday: 0,
    dailyGoalXp: 50,
    nextMission: null,
    units: [],
  };
  /** Answers each subject from `maps`, and records which subject was asked for. */
  function mapsBySubject(maps: Record<string, object>, asked: (string | null)[] = []) {
    server.use(
      http.get('*/v1/student/map', ({ request }) => {
        const id = new URL(request.url).searchParams.get('subjectId');
        asked.push(id);
        return HttpResponse.json(maps[id ?? 'default']);
      }),
    );
    return asked;
  }

  it('says the questions are on their way and offers a subject that has some', async () => {
    const asked = mapsBySubject({
      default: { ...comingSoon, subjects },
      'gcse-maths': { ...topicMap, subjectId: 'gcse-maths', status: 'ready', subjects },
    });
    renderRoute('/map');
    expect(
      await screen.findByText('Questions for Chemistry are on their way.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try Maths meanwhile' }));
    expect(await screen.findByRole('region', { name: 'Number' })).toBeInTheDocument();
    expect(asked).toContain('gcse-maths');
  });

  it('shows the friendly message alone when no subject has questions yet', async () => {
    const only = [{ subjectId: 'gcse-chemistry', subject: 'Chemistry', hasContent: false }];
    mapsBySubject({ default: { ...comingSoon, subjects: only } });
    renderRoute('/map');
    expect(
      await screen.findByText('Questions for Chemistry are on their way.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /meanwhile/ })).not.toBeInTheDocument();
  });

  it('switches subject from the subject switcher', async () => {
    const asked = mapsBySubject({
      default: { ...topicMap, subjectId: 'gcse-maths', status: 'ready', subjects },
      'gcse-chemistry': { ...comingSoon, subjects },
    });
    renderRoute('/map');
    const switcher = await screen.findByRole('group', { name: 'Subject' });
    expect(within(switcher).getByRole('button', { name: 'Maths' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(
      within(switcher).getByRole('button', { name: 'Chemistry (coming soon)' }),
    );
    expect(
      await screen.findByText('Questions for Chemistry are on their way.'),
    ).toBeInTheDocument();
    expect(asked).toContain('gcse-chemistry');
  });
});
