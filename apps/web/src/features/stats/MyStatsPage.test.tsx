import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { demoStats } from './mocks';

const open = async () => {
  renderRoute('/progress');
  await screen.findByRole('heading', { level: 1, name: 'My stats' });
  return screen.findByRole('group', { name: 'Period' });
};

describe('My stats', () => {
  it('opens on this week with the headline tiles', async () => {
    await open();
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    const xp = screen.getByRole('group', { name: 'XP' });
    expect(xp).toHaveTextContent('95');
    expect(xp).toHaveTextContent('+15 on last week');
    expect(screen.getByRole('group', { name: 'Questions' })).toHaveTextContent('11 correct');
    expect(screen.getByRole('group', { name: 'Accuracy' })).toHaveTextContent('Same as last week');
    expect(screen.getByRole('group', { name: 'Streak' })).toHaveTextContent('3 days');
    expect(screen.getByText('Daily goal: 50 XP')).toBeInTheDocument();
  });

  it('never shows a drop to the student', async () => {
    await open();
    // Questions fell from 16 to 14 and Physics mastery fell by 3: neither is called out.
    expect(screen.getByRole('group', { name: 'Questions' })).not.toHaveTextContent(/last week/);
    const mastery = screen.getByRole('region', { name: 'Mastery by subject' });
    expect(within(mastery).getByText('+4 this week')).toBeInTheDocument();
    expect(mastery).not.toHaveTextContent('-3');
    expect(document.body).not.toHaveTextContent(/worse|down/i);
  });

  it('switches the period and its chart', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Term' }));
    expect(await screen.findByText('Weekly goal: 250 XP')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'XP per week' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Year' }));
    expect(await screen.findByRole('table', { name: 'XP per month' })).toBeInTheDocument();
    expect(screen.queryByText(/goal:/)).not.toBeInTheDocument();
  });

  it('shows personal bests and the level as not set up yet', async () => {
    await open();
    const bests = screen.getByRole('region', { name: 'Personal bests' });
    expect(bests).toHaveTextContent('9 days');
    expect(bests).toHaveTextContent('12 in a row');
    expect(bests).toHaveTextContent('260 XP');
    expect(screen.getByRole('region', { name: 'Level' })).toHaveTextContent('Not set up yet');
  });

  it('shows the level bar once levels exist, and empty states without data', async () => {
    server.use(
      http.get('*/v1/student/stats', () =>
        HttpResponse.json({
          ...demoStats('week'),
          tiles: { ...demoStats('week').tiles, accuracy: { value: null, previous: null } },
          mastery: [],
          personalBests: { longestStreak: 0, longestCorrectRun: 0, bestWeek: null },
          level: { level: 4, xpIntoLevel: 30, xpForNextLevel: 120 },
        }),
      ),
    );
    await open();
    expect(screen.getByRole('progressbar', { name: 'Level 4' })).toHaveAttribute(
      'aria-valuetext',
      '30 of 120 XP to level 5',
    );
    expect(screen.getByRole('group', { name: 'Accuracy' })).toHaveTextContent('No marked answers');
    expect(screen.getByText('Start a lesson to see your mastery here.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Personal bests' })).toHaveTextContent('Not yet');
  });

  it('shows a retry when stats cannot load', async () => {
    server.use(http.get('*/v1/student/stats', () => HttpResponse.json({}, { status: 500 })));
    renderRoute('/progress');
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  });
});
