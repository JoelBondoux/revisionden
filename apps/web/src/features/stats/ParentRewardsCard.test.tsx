import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderRoute } from '../../test/render';
import { resetRewardsMocks } from '../rewards/mocks';

beforeEach(() => resetRewardsMocks());

const openCard = async () => {
  renderRoute('/parent/stats');
  return screen.findByRole('region', { name: 'Rewards' });
};

const addReward = async (card: HTMLElement, title: string) => {
  await userEvent.click(within(card).getByRole('button', { name: 'Add a reward' }));
  const form = within(card).getByRole('form', { name: 'Reward details' });
  await userEvent.type(within(form).getByLabelText('Reward'), title);
  await userEvent.selectOptions(within(form).getByLabelText('When they reach'), 'level');
  await userEvent.clear(within(form).getByLabelText('Level'));
  await userEvent.type(within(form).getByLabelText('Level'), '10');
  await userEvent.click(within(form).getByRole('button', { name: 'Save reward' }));
};

describe('rewards on the parent stats page', () => {
  it('has a friendly empty state with a way to add one', async () => {
    const card = await openCard();
    expect(await within(card).findByText(/No rewards yet/)).toBeVisible();
    expect(within(card).getByRole('button', { name: 'Add a reward' })).toBeInTheDocument();
  });

  it('adds rewards here and lists them all with progress', async () => {
    const card = await openCard();
    await addReward(card, 'Cinema trip');
    expect(await within(card).findByRole('progressbar', { name: 'Cinema trip' })).toBeVisible();
    await addReward(card, 'New game');
    expect(await within(card).findByRole('progressbar', { name: 'New game' })).toBeVisible();
    expect(within(card).getAllByRole('progressbar')).toHaveLength(2);
    expect(within(card).queryByRole('form', { name: 'Reward details' })).not.toBeInTheDocument();
  });

  it('checks the reward the same way as the rewards page', async () => {
    const card = await openCard();
    await userEvent.click(within(card).getByRole('button', { name: 'Add a reward' }));
    const form = within(card).getByRole('form', { name: 'Reward details' });
    await userEvent.click(within(form).getByRole('button', { name: 'Save reward' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('Give the reward a short title');
  });

  it('edits a reward in the same editor', async () => {
    const card = await openCard();
    await addReward(card, 'Cinema trip');
    await userEvent.click(await within(card).findByRole('button', { name: 'Edit Cinema trip' }));
    const form = within(card).getByRole('form', { name: 'Reward details' });
    const title = within(form).getByLabelText('Reward');
    expect(title).toHaveValue('Cinema trip');
    await userEvent.clear(title);
    await userEvent.type(title, 'Bowling');
    await userEvent.click(within(form).getByRole('button', { name: 'Save reward' }));
    expect(await within(card).findByRole('progressbar', { name: 'Bowling' })).toBeVisible();
    expect(within(card).queryByText('Cinema trip')).not.toBeInTheDocument();
  });

  it('asks before removing a reward, and can keep it', async () => {
    const card = await openCard();
    await addReward(card, 'Cinema trip');
    await userEvent.click(await within(card).findByRole('button', { name: 'Remove Cinema trip' }));
    const confirm = within(card).getByRole('group', { name: 'Remove Cinema trip?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Keep it' }));
    expect(within(card).getByRole('progressbar', { name: 'Cinema trip' })).toBeVisible();

    await userEvent.click(within(card).getByRole('button', { name: 'Remove Cinema trip' }));
    await userEvent.click(
      within(within(card).getByRole('group', { name: 'Remove Cinema trip?' })).getByRole('button', {
        name: 'Yes, remove',
      }),
    );
    expect(await within(card).findByText(/No rewards yet/)).toBeVisible();
  });

  it('reads rewards without using up the child’s "New!" rewards', async () => {
    let fullViewCalls = 0;
    server.use(
      http.get('*/v1/students/:id/rewards', () => {
        fullViewCalls += 1;
        return HttpResponse.json({}, { status: 500 });
      }),
    );
    const card = await openCard();
    expect(await within(card).findByText(/No rewards yet/)).toBeVisible();
    expect(fullViewCalls).toBe(0);
  });

  it('can cancel the editor without saving', async () => {
    const card = await openCard();
    await userEvent.click(within(card).getByRole('button', { name: 'Add a reward' }));
    await userEvent.click(within(card).getByRole('button', { name: 'Cancel' }));
    expect(within(card).queryByRole('form', { name: 'Reward details' })).not.toBeInTheDocument();
    expect(await within(card).findByText(/No rewards yet/)).toBeVisible();
  });
});
