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
    const today = screen.getByRole('region', { name: 'Today' });
    expect(within(today).getByRole('progressbar', { name: 'Daily goal' })).toHaveAttribute(
      'aria-valuetext',
      '30 of 50 XP',
    );
  });

  it('leads with the next mission in the Today strip', async () => {
    renderRoute('/map');
    const today = await screen.findByRole('region', { name: 'Today' });
    expect(today).toHaveTextContent('Next mission');
    expect(today).toHaveTextContent('Fix weak spot: Surds');
    expect(within(today).getByRole('link', { name: 'Go: Fix weak spot: Surds' })).toHaveAttribute(
      'href',
      '/learn/topic/surds',
    );
  });

  it('puts the 5-a-day in the Today strip', async () => {
    renderRoute('/map');
    const today = await screen.findByRole('region', { name: 'Today' });
    expect(await within(today).findByRole('link', { name: 'Start your 5-a-day' })).toHaveAttribute(
      'href',
      '/learn/daily',
    );
    expect(today).toHaveTextContent('0 of 2 done');
  });

  it('shows every unit on the path, with the current unit chosen', async () => {
    renderRoute('/map');
    const units = await screen.findByRole('group', { name: 'Units' });
    const number = within(units).getByRole('button', { name: 'Number, 57% mastered' });
    expect(number).toHaveAttribute('aria-pressed', 'true');
    expect(within(units).getByRole('button', { name: 'Algebra, coming soon' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows the chosen unit with its mastery and all of its topics', async () => {
    renderRoute('/map');
    const number = await screen.findByRole('region', { name: 'Number' });
    expect(number).toHaveTextContent('57% mastered');
    const topics = within(number).getByRole('region', { name: 'Number topics' });
    expect(topics).toHaveAttribute('tabindex', '0');
    const path = within(topics);
    expect(path.getByRole('link', { name: 'Fractions, mastered' })).toBeInTheDocument();
    expect(path.getByRole('link', { name: 'Indices, mastered' })).toBeInTheDocument();
    expect(path.getByRole('link', { name: 'Surds, weak, 38% mastered' })).toBeInTheDocument();
    expect(path.getByRole('link', { name: 'Standard form, 45% mastered' })).toBeInTheDocument();
    expect(path.getByRole('button', { name: 'Bounds, locked' })).toBeInTheDocument();
    expect(
      path.getByRole('button', { name: 'Challenge, unlocks at 80% mastered in Number' }),
    ).toBeInTheDocument();
  });

  it('swaps the card to another unit, and says how a locked unit unlocks', async () => {
    renderRoute('/map');
    const units = await screen.findByRole('group', { name: 'Units' });
    await userEvent.click(within(units).getByRole('button', { name: 'Algebra, coming soon' }));
    const algebra = await screen.findByRole('region', { name: 'Algebra' });
    expect(algebra).toHaveTextContent(
      "Questions for Algebra are on their way. It unlocks as soon as they're ready.",
    );
    expect(within(algebra).getByRole('button', { name: 'Expanding, locked' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Number' })).not.toBeInTheDocument();
    expect(within(units).getByRole('button', { name: 'Algebra, coming soon' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it("keeps each unit's place on the path when switching back", async () => {
    renderRoute('/map');
    const units = await screen.findByRole('group', { name: 'Units' });
    const path = screen.getByRole('region', { name: 'Number topics' });
    path.scrollTop = 120;
    path.dispatchEvent(new Event('scroll'));
    await userEvent.click(within(units).getByRole('button', { name: 'Algebra, coming soon' }));
    await screen.findByRole('region', { name: 'Algebra topics' });
    await userEvent.click(within(units).getByRole('button', { name: 'Number, 57% mastered' }));
    expect((await screen.findByRole('region', { name: 'Number topics' })).scrollTop).toBe(120);
  });

  it('opens an overview of all units from See all, and goes to the one chosen', async () => {
    renderRoute('/map');
    await userEvent.click(await screen.findByRole('button', { name: 'See all units' }));
    const all = await screen.findByRole('dialog', { name: 'All units' });
    expect(
      within(all).getByRole('button', { name: /Number.*2 of 5 topics mastered/ }),
    ).toBeInTheDocument();
    await userEvent.click(within(all).getByRole('button', { name: /Algebra/ }));
    expect(await screen.findByRole('region', { name: 'Algebra' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'All units' })).not.toBeInTheDocument();
  });

  it('explains how to unlock a locked topic', async () => {
    renderRoute('/map');
    await userEvent.click(await screen.findByRole('button', { name: 'Bounds, locked' }));
    const message = await screen.findByText('Finish the topics before Bounds to unlock it.');
    expect(message.closest('[role="status"]')).not.toBeNull();
  });

  // J12d (owner, 2026-11-26): "195 / 50 XP" with a full bar looked odd. Past the goal, the strip
  // celebrates instead.
  it('celebrates a smashed daily goal instead of showing an odd fraction', async () => {
    server.use(
      http.get('*/v1/student/map', async () => {
        const { topicMap } = await import('../mocks/data');
        return HttpResponse.json({ ...topicMap, xpToday: 195, dailyGoalXp: 50 });
      }),
    );
    renderRoute('/map');
    const today = await screen.findByRole('region', { name: 'Today' });
    await within(today).findByText('Goal smashed!');
    expect(today).toHaveTextContent('195 XP');
    expect(today).not.toHaveTextContent('195 / 50');
    expect(within(today).getByRole('progressbar', { name: 'Daily goal' })).toHaveAttribute(
      'aria-valuetext',
      'Goal smashed: 195 XP, goal 50 XP',
    );
  });

  it('leaves the next mission out of the Today strip when there is none', async () => {
    server.use(
      http.get('*/v1/student/map', async () => {
        const { topicMap } = await import('../mocks/data');
        return HttpResponse.json({ ...topicMap, nextMission: null });
      }),
    );
    renderRoute('/map');
    const today = await screen.findByRole('region', { name: 'Today' });
    await screen.findByRole('region', { name: 'Number' });
    expect(today).not.toHaveTextContent('Next mission');
    expect(within(today).queryByRole('link', { name: /^Go:/ })).not.toBeInTheDocument();
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
              studentId: '00000000-0000-4000-8000-0000000000a1',
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
