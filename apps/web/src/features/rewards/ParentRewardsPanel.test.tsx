import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CreateParentRewardRequest, ParentReward } from '@revisionden/core';
import type { RewardsApi } from './rewardsApi';
import { ParentRewardsPanel } from './ParentRewardsPanel';
import { cinemaTrip, sampleRewards, sampleTitle } from './fixtures';

function memoryApi(initial: ParentReward[] = []) {
  let list = [...initial];
  const added: CreateParentRewardRequest[] = [];
  const api: RewardsApi = {
    getMyRewards: async () => sampleRewards(),
    getMyTitle: async () => sampleTitle,
    setMyTitle: async () => sampleTitle,
    getChildRewards: async () => sampleRewards({ parentRewards: list }),
    addParentReward: async (_id, body) => {
      added.push(body);
      const reward = {
        ...cinemaTrip,
        id: `id-${added.length}`,
        title: body.title,
        target: body.target,
      };
      list = [...list, reward];
      return reward;
    },
    markGiven: async (_id, rewardId) => {
      list = list.map((r) =>
        r.id === rewardId ? { ...r, givenAt: '2026-11-24T10:00:00.000Z' } : r,
      );
      return list.find((r) => r.id === rewardId)!;
    },
    removeParentReward: async (_id, rewardId) => {
      list = list.filter((r) => r.id !== rewardId);
    },
    updateParentReward: async (_id, rewardId) => list.find((r) => r.id === rewardId)!,
  };
  return { api, added };
}

describe('Parent rewards panel', () => {
  it("lists the child's real-world rewards and their progress", async () => {
    const { api } = memoryApi([cinemaTrip]);
    render(<ParentRewardsPanel api={api} studentId="s1" nickname="Comet" />);
    const item = await screen.findByRole('listitem', { name: 'Cinema trip' });
    expect(within(item).getByText('100-day streak')).toBeInTheDocument();
    expect(within(item).getByText('5 of 100')).toBeInTheDocument();
  });

  it('adds a reward tied to a catalogue reward', async () => {
    const { api, added } = memoryApi();
    render(<ParentRewardsPanel api={api} studentId="s1" nickname="Comet" />);
    await userEvent.type(await screen.findByLabelText('Reward'), 'Cinema trip');
    await userEvent.selectOptions(screen.getByLabelText('When they reach'), 'streak-100');
    await userEvent.click(screen.getByRole('button', { name: 'Add reward' }));
    expect(added).toEqual([
      { title: 'Cinema trip', target: { kind: 'reward', rewardId: 'streak-100' } },
    ]);
    expect(await screen.findByRole('listitem', { name: 'Cinema trip' })).toBeInTheDocument();
  });

  it('adds a reward tied to a level', async () => {
    const { api, added } = memoryApi();
    render(<ParentRewardsPanel api={api} studentId="s1" nickname="Comet" />);
    await userEvent.type(await screen.findByLabelText('Reward'), 'New game');
    await userEvent.selectOptions(screen.getByLabelText('When they reach'), 'level');
    const level = screen.getByLabelText('Level');
    await userEvent.clear(level);
    await userEvent.type(level, '20');
    await userEvent.click(screen.getByRole('button', { name: 'Add reward' }));
    expect(added).toEqual([
      { title: 'New game', target: { kind: 'stat', stat: 'level', atLeast: 20 } },
    ]);
  });

  it('adds a reward with a note and a custom date', async () => {
    const { api, added } = memoryApi();
    render(<ParentRewardsPanel api={api} studentId="s1" nickname="Comet" />);
    await userEvent.type(await screen.findByLabelText('Reward'), 'Day out');
    await userEvent.type(screen.getByLabelText('Note (optional)'), 'You pick where');
    await userEvent.selectOptions(screen.getByLabelText('When they reach'), 'date');
    await userEvent.type(screen.getByLabelText('Date'), '2027-02-14');
    await userEvent.click(screen.getByRole('button', { name: 'Add reward' }));
    expect(added).toEqual([
      { title: 'Day out', note: 'You pick where', target: { kind: 'date', on: '2027-02-14' } },
    ]);
  });

  it('can remove a reward before it is given', async () => {
    const { api } = memoryApi([cinemaTrip]);
    render(<ParentRewardsPanel api={api} studentId="s1" nickname="Comet" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Cinema trip' }));
    expect(await screen.findByText(/No real-world rewards yet/)).toBeInTheDocument();
  });

  it('marks a reward as given, then keeps it as history', async () => {
    const { api } = memoryApi([{ ...cinemaTrip, reached: true }]);
    render(<ParentRewardsPanel api={api} studentId="s1" nickname="Comet" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Mark Cinema trip as given' }));
    expect(await screen.findByText('Given')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Cinema trip' })).not.toBeInTheDocument();
  });

  it('does not add a date reward without a date', async () => {
    const { api, added } = memoryApi();
    render(<ParentRewardsPanel api={api} studentId="s1" nickname="Comet" />);
    await userEvent.type(await screen.findByLabelText('Reward'), 'Day out');
    await userEvent.selectOptions(screen.getByLabelText('When they reach'), 'date');
    await userEvent.click(screen.getByRole('button', { name: 'Add reward' }));
    expect(added).toEqual([]);
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a date');
  });

  it('does not add a reward without a title', async () => {
    const { api, added } = memoryApi();
    render(<ParentRewardsPanel api={api} studentId="s1" nickname="Comet" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add reward' }));
    expect(added).toEqual([]);
    expect(screen.getByRole('alert')).toHaveTextContent('Give the reward a short title');
  });
});
