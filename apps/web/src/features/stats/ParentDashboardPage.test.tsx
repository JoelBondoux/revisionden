import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { demoDashboard } from './mocks';

const open = async () => {
  renderRoute('/parent/stats');
  await screen.findByRole('heading', { level: 1, name: 'Stats dashboard' });
  return screen.findByRole('group', { name: 'Active study time' });
};

describe('Parent stats dashboard', () => {
  it('shows this week for the first child, with changes on last week', async () => {
    const study = await open();
    expect(study).toHaveTextContent('1 h 35 min');
    expect(study).toHaveTextContent('15 min less than last week');
    expect(screen.getByRole('group', { name: 'Accuracy' })).toHaveTextContent('+5 on last week');
    expect(screen.getByRole('group', { name: 'Plan kept' })).toHaveTextContent('No plan yet');
    expect(screen.getByRole('group', { name: 'Streak' })).toHaveTextContent('best 9');
    expect(screen.getByRole('table', { name: 'Study time, last 8 weeks' })).toBeInTheDocument();
  });

  it('opens on the child chosen on "Who\'s revising?"', async () => {
    renderRoute('/parent/stats?student=00000000-0000-4000-8000-0000000000a2');
    expect(await screen.findByRole('heading', { level: 2, name: 'demo_owl' })).toBeInTheDocument();
    expect(screen.getByLabelText('Student')).toHaveValue('00000000-0000-4000-8000-0000000000a2');
  });

  it('switches between children', async () => {
    await open();
    expect(screen.getByRole('heading', { level: 2, name: 'demo_fox' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Student'), 'demo_owl');
    expect(await screen.findByRole('heading', { level: 2, name: 'demo_owl' })).toBeInTheDocument();
  });

  it('shows subjects, weak spots and drops plainly to the parent', async () => {
    await open();
    const subjects = screen.getByRole('table', { name: 'Subjects' });
    const physics = within(subjects).getByRole('row', { name: /Physics/ });
    expect(physics).toHaveTextContent('48%');
    expect(physics).toHaveTextContent('-3');
    expect(physics).toHaveTextContent('Not set up yet');
    const weak = screen.getByRole('region', { name: 'Weak spots' });
    expect(weak).toHaveTextContent('Demo topic C');
    expect(weak).toHaveTextContent('30% → 35%');
  });

  it('says "Not set up yet" for panels without data, never zeros', async () => {
    await open();
    expect(screen.getByRole('region', { name: 'School report effort' })).toHaveTextContent(
      'Not set up yet',
    );
    expect(screen.getByRole('region', { name: 'Reward' })).toHaveTextContent('Not set up yet');
  });

  it('shows healthy habits, the AI marking allowance and recent activity', async () => {
    await open();
    const habits = screen.getByRole('region', { name: 'Healthy habits' });
    expect(habits).toHaveTextContent('1 session in quiet hours');
    expect(habits).toHaveTextContent('0 days at the daily limit (120 minutes today)');
    const allowance = screen.getByRole('region', { name: 'AI marking allowance' });
    expect(
      within(allowance).getByRole('progressbar', { name: 'AI marking allowance' }),
    ).toHaveAttribute('aria-valuetext', '16% used');
    expect(allowance).toHaveTextContent('16% used this month');
    expect(allowance).toHaveTextContent('Resets on 1 December');
    const activity = within(screen.getByRole('region', { name: 'Recent activity' })).getAllByRole(
      'listitem',
    );
    expect(activity[0]).toHaveTextContent('Flashcards: 6 reviews');
    expect(activity[1]).toHaveTextContent('Lesson in Maths: 8 questions');
  });

  it('shows set-up panels once their data exists', async () => {
    server.use(
      http.get('*/v1/students/:id/dashboard', () =>
        HttpResponse.json({
          ...demoDashboard(),
          tiles: { ...demoDashboard().tiles, planKept: { done: 3, planned: 4 } },
          studyTime: { ...demoDashboard().studyTime, planMinutes: 120 },
          subjects: [{ ...demoDashboard().subjects[0], predictedGrade: '6', targetGrade: '7' }],
          effortScores: {
            date: '2026-11-01',
            scores: [{ label: 'Commitment', value: '3', scale: '1 to 4' }],
          },
          rewards: [
            {
              title: 'Cinema trip',
              targetLabel: '30-day streak',
              current: 12,
              goal: 30,
              reached: false,
              given: false,
            },
            {
              title: 'New game',
              targetLabel: 'Level 10',
              current: 10,
              goal: 10,
              reached: true,
              given: false,
            },
          ],
        }),
      ),
    );
    await open();
    expect(screen.getByRole('group', { name: 'Plan kept' })).toHaveTextContent('3 of 4');
    expect(screen.getByText('Weekly plan: 2 h')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Maths/ })).toHaveTextContent('6 (target 7)');
    expect(screen.getByRole('region', { name: 'School report effort' })).toHaveTextContent(
      'Commitment: 3 (1 to 4)',
    );
    expect(screen.getByRole('progressbar', { name: 'Cinema trip' })).toHaveAttribute(
      'aria-valuetext',
      '12 of 30 (30-day streak)',
    );
    expect(screen.getByRole('region', { name: 'Reward' })).toHaveTextContent('New game: reached');
  });

  it('saves as PDF in the browser', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Save as PDF' }));
    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });

  it('asks the parent to add a child when there are none', async () => {
    server.use(http.get('*/v1/students', () => HttpResponse.json({ students: [] })));
    renderRoute('/parent/stats');
    expect(await screen.findByText(/No children yet/)).toBeInTheDocument();
  });

  it('says when this month’s AI marking allowance is used up', async () => {
    server.use(
      http.get('*/v1/students/:id/dashboard', () =>
        HttpResponse.json({
          ...demoDashboard(),
          aiSpend: { month: '2026-12', spentMicroUsd: 2_500_000, capMicroUsd: 2_500_000 },
        }),
      ),
    );
    await open();
    const allowance = screen.getByRole('region', { name: 'AI marking allowance' });
    expect(allowance).toHaveTextContent(
      'This month’s AI marking allowance is used up. It resets on 1 January.',
    );
  });

  it('never shows money, spend or cost for AI to a family', async () => {
    await open();
    const page = document.body.textContent ?? '';
    expect(page).not.toMatch(/US\$|£|\$\d|spend|cost/i);
  });
});
