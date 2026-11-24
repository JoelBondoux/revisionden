import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RewardsApi } from './rewardsApi';
import { RewardsScreen } from './RewardsPage';
import { cinemaTrip, sampleRewards } from './fixtures';

function fakeApi(over: Partial<RewardsApi> = {}): RewardsApi {
  return {
    getMyRewards: async () => sampleRewards({ parentRewards: [cinemaTrip] }),
    getChildRewards: async () => sampleRewards(),
    addParentReward: async () => cinemaTrip,
    markGiven: async () => cinemaTrip,
    removeParentReward: async () => undefined,
    ...over,
  };
}

const show = (api: RewardsApi) => render(<RewardsScreen api={api} />);

describe('Student rewards screen', () => {
  it('shows the level and progress to the next one', async () => {
    show(fakeApi());
    expect(await screen.findByRole('heading', { name: 'Level 4' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'XP to level 5' })).toHaveAttribute(
      'aria-valuetext',
      '50 of 450 XP',
    );
  });

  it('shows the current year chapter track and the next step', async () => {
    show(fakeApi());
    const chapter = await screen.findByRole('region', { name: 'Chapter 2: Building Up' });
    expect(within(chapter).getByText(/3 of 30 unlocked/)).toBeInTheDocument();
    expect(within(chapter).getByText(/Next: Rising Star/)).toBeInTheDocument();
    expect(within(chapter).getAllByRole('listitem')).toHaveLength(30);
  });

  it('shows the next milestones, collections and the live seasonal drop', async () => {
    show(fakeApi());
    const milestones = await screen.findByRole('region', { name: 'Next milestones' });
    expect(within(milestones).getByText('100 right answers')).toBeInTheDocument();
    const sets = screen.getByRole('region', { name: 'Collections' });
    expect(within(sets).getByText('Gig kit')).toBeInTheDocument();
    const drop = screen.getByRole('region', { name: 'Frost Fest' });
    expect(within(drop).getByText(/Ends 3 January 2027/)).toBeInTheDocument();
  });

  it('shows parent-set rewards with a parent badge', async () => {
    show(fakeApi());
    const parent = await screen.findByRole('region', { name: 'From your parent' });
    expect(within(parent).getByText('Cinema trip')).toBeInTheDocument();
    expect(within(parent).getByText('Parent reward')).toBeInTheDocument();
    expect(within(parent).getByText('100-day streak')).toBeInTheDocument();
  });

  it('celebrates rewards earned since the last visit', async () => {
    const newly = sampleRewards().overview.chapter!.steps[0]!;
    show(fakeApi({ getMyRewards: async () => sampleRewards({ newlyEarned: [newly] }) }));
    const note = await screen.findByText(/New: Practice amp/);
    expect(note.closest('[role="status"]')).not.toBeNull();
  });

  it('offers a retry when loading fails', async () => {
    let calls = 0;
    show(
      fakeApi({
        getMyRewards: async () => {
          calls += 1;
          if (calls === 1) throw new Error('offline');
          return sampleRewards();
        },
      }),
    );
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('heading', { name: 'Level 4' })).toBeInTheDocument();
  });
});
