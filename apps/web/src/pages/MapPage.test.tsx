import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderRoute } from '../test/render';
import { topicMap } from '../mocks/data';
import { chooseSubject, chosenSubject } from '../features/subjects';
import { levelOf } from './MapPage';

describe('Topic map screen', () => {
  it('sends you to choose a student when nobody is chosen yet', async () => {
    renderRoute('/map', { studentId: null });
    expect(
      await screen.findByRole('heading', { level: 1, name: "Who's revising?" }),
    ).toBeInTheDocument();
  });

  // The old /learn address now opens Home (J15b): see features/home/HomePage.test.tsx.

  // UX-2 (owner-approved UX report): one compact line on top of the path instead of a title row,
  // a big subject box and a qualification line. The page still has its heading for screen readers.
  it('shows the subject and level as one compact button, and the streak', async () => {
    const { container } = renderRoute('/map');
    const subject = await screen.findByRole('button', { name: 'Maths · Higher, change subject' });
    expect(subject).toHaveTextContent(/^Maths · Higher/);
    expect(screen.getByRole('heading', { level: 1, name: 'Topic map' })).toBeInTheDocument();
    expect(screen.queryByText('GCSE Higher Maths')).not.toBeInTheDocument();
    // The streak takes the top bar's free spot (the map's subject button replaces the switcher).
    await waitFor(() =>
      expect(container.querySelector('.sound-header')).toHaveTextContent('4 day streak'),
    );
  });

  // Lead on UX-2: changing subject was hard to find, so the map has exactly one subject control,
  // the same chip as the top bar's switcher on Home and Cards, opening the same sheet.
  it('has exactly one subject control, which opens Your subjects', async () => {
    renderRoute('/map');
    await screen.findByRole('region', { name: 'Number' });
    const controls = await screen.findAllByRole('button', { name: /, change subject$/ });
    expect(controls).toHaveLength(1);
    expect(controls[0]).toHaveAccessibleName('Maths · Higher, change subject');
    expect(controls[0]).toHaveClass('subject-switcher');
    expect(controls[0]).toHaveAttribute('aria-haspopup', 'dialog');
    await userEvent.click(controls[0]!);
    expect(await screen.findByRole('dialog', { name: 'Your subjects' })).toBeInTheDocument();
  });

  // J15b: the map is topics only. The daily goal, next mission and 5-a-day moved to Home
  // (features/home/HomePage.test.tsx).
  it('has no Today strip any more', async () => {
    renderRoute('/map');
    await screen.findByRole('region', { name: 'Number' });
    expect(screen.queryByRole('region', { name: 'Today' })).not.toBeInTheDocument();
  });

  // J15c (owner sign-off of the all-themes mockup, revision 5): one unit at a time on a winding
  // path that climbs from the bottom; swipe sideways (or use the arrows) for the next unit.
  it('opens on the current unit, with arrows and a swipeable pager for the others', async () => {
    renderRoute('/map');
    const pager = await screen.findByRole('group', { name: 'Units' });
    expect(within(pager).getByRole('region', { name: 'Number' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Number' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous unit' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next unit' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Algebra' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next unit' })).toBeDisabled();
  });

  it('moves between units with the arrow keys too', async () => {
    renderRoute('/map');
    const pager = await screen.findByRole('group', { name: 'Units' });
    pager.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(await screen.findByRole('heading', { level: 2, name: 'Algebra' })).toBeInTheDocument();
    await userEvent.keyboard('{ArrowLeft}');
    expect(await screen.findByRole('heading', { level: 2, name: 'Number' })).toBeInTheDocument();
  });

  it('shows every topic of a unit on its path, and the unit quest at the top', async () => {
    renderRoute('/map');
    const number = await screen.findByRole('region', { name: 'Number' });
    const path = within(number);
    expect(path.getByRole('link', { name: 'Fractions, mastered' })).toHaveAttribute(
      'href',
      '/learn/topic/fractions',
    );
    expect(path.getByRole('link', { name: 'Indices, mastered' })).toBeInTheDocument();
    expect(
      path.getByRole('link', { name: 'Surds, weak, 38% mastered, you are here' }),
    ).toBeInTheDocument();
    expect(path.getByRole('link', { name: 'Standard form, 45% mastered' })).toBeInTheDocument();
    expect(path.getByRole('button', { name: 'Bounds, locked' })).toBeInTheDocument();
    expect(
      path.getByRole('button', { name: 'Challenge, unlocks at 80% mastered in Number' }),
    ).toBeInTheDocument();
    expect(number).toHaveTextContent('57% mastered');
  });

  it("puts the You are here tag on the next mission's topic, and only there", async () => {
    renderRoute('/map');
    const number = await screen.findByRole('region', { name: 'Number' });
    expect(within(number).getAllByText('You are here')).toHaveLength(1);
    expect(within(number).getByRole('link', { name: /you are here$/ })).toHaveAttribute(
      'href',
      '/learn/topic/surds',
    );
  });

  it('says how a unit with no questions yet unlocks', async () => {
    renderRoute('/map');
    await userEvent.click(await screen.findByRole('button', { name: 'Next unit' }));
    const algebra = await screen.findByRole('region', { name: 'Algebra' });
    expect(algebra).toHaveTextContent(
      "Questions for Algebra are on their way. It unlocks as soon as they're ready.",
    );
    expect(within(algebra).getByRole('button', { name: 'Expanding, locked' })).toBeInTheDocument();
  });

  it('explains how to unlock a locked topic', async () => {
    renderRoute('/map');
    await userEvent.click(await screen.findByRole('button', { name: 'Bounds, locked' }));
    const message = await screen.findByText('Finish the topics before Bounds to unlock it.');
    expect(message.closest('[role="status"]')).not.toBeNull();
  });

  // J15b: Pip, the Home button, dresses for the subject shown on the map.
  it('dresses Pip for the subject on the map', async () => {
    const { container } = renderRoute('/map');
    await screen.findByRole('region', { name: 'Number' });
    const pip = screen.getByRole('button', { name: 'Home' });
    await waitFor(() => expect(pip.querySelector('[data-prop="calculator"]')).not.toBeNull());
    void container;
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

  it('changes subject from the subject button, through Your subjects to Subject selection', async () => {
    const asked = mapsBySubject({
      default: { ...topicMap, subjectId: 'gcse-maths', status: 'ready', subjects },
      'gcse-chemistry': { ...comingSoon, subjects },
    });
    renderRoute('/map');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Maths · Higher, change subject' }),
    );
    const sheet = await screen.findByRole('dialog', { name: 'Your subjects' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add or change subjects' }));
    const picker = await screen.findByRole('region', { name: 'Pick a subject' });
    expect(within(picker).getByRole('button', { name: 'Maths' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(within(picker).getByRole('button', { name: 'Chemistry Coming soon' }));
    expect(
      await screen.findByText('Questions for Chemistry are on their way.'),
    ).toBeInTheDocument();
    expect(asked).toContain('gcse-chemistry');
  });

  it('goes back from Subject selection without changing anything', async () => {
    mapsBySubject({ default: { ...topicMap, subjectId: 'gcse-maths', status: 'ready', subjects } });
    renderRoute('/map');
    await userEvent.click(
      await screen.findByRole('button', { name: 'Maths · Higher, change subject' }),
    );
    const sheet = await screen.findByRole('dialog', { name: 'Your subjects' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add or change subjects' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back to the map' }));
    expect(await screen.findByRole('region', { name: 'Number' })).toBeInTheDocument();
  });
});

describe('the remembered subject (UX-1, Codex on #423)', () => {
  const subjects = [{ subjectId: 'gcse-maths', subject: 'Maths', hasContent: true }];

  it('falls back to the default when the remembered subject was dropped and has no topics', async () => {
    chooseSubject('student-1', 'gcse-art');
    server.use(
      http.get('*/v1/student/map', ({ request }) => {
        const id = new URL(request.url).searchParams.get('subjectId');
        if (id === 'gcse-art')
          return HttpResponse.json(
            { error: { code: 'no_subject', message: 'Choose a subject first' } },
            { status: 404 },
          );
        return HttpResponse.json({ ...topicMap, subjectId: 'gcse-maths', subjects });
      }),
    );
    renderRoute('/map');
    expect(await screen.findByRole('region', { name: 'Number' })).toBeInTheDocument();
    expect(chosenSubject('student-1')).toBeUndefined();
  });

  it('opens the subject picker from the top bar while already on the map', async () => {
    server.use(
      http.get('*/v1/student/map', () =>
        HttpResponse.json({ ...topicMap, subjectId: 'gcse-maths', subjects }),
      ),
    );
    renderRoute('/map');
    await screen.findByRole('region', { name: 'Number' });
    await userEvent.click(await screen.findByRole('button', { name: /, change subject$/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Your subjects' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add or change subjects' }));
    expect(await screen.findByRole('region', { name: 'Pick a subject' })).toBeInTheDocument();
  });
});

describe("the level on the map's subject button", () => {
  it('drops the GCSE or A-Level word and keeps the tier', () => {
    expect(levelOf('GCSE Higher')).toBe('Higher');
    expect(levelOf('GCSE Foundation')).toBe('Foundation');
    expect(levelOf('A-Level Year 12')).toBe('Year 12');
  });

  it('shows a qualification with nothing after it whole', () => {
    expect(levelOf('A-Level')).toBe('A-Level');
    expect(levelOf('GCSE')).toBe('GCSE');
  });
});
