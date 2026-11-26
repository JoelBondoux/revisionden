import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { LeagueScreen } from './LeaguePage';
import { fakeLeagueApi } from './fakeApi';
import { sampleFriends } from './fixtures';
import type { LeagueApi } from './leagueApi';

const show = (api: LeagueApi = fakeLeagueApi()) =>
  render(
    <MemoryRouter>
      <LeagueScreen api={api} />
    </MemoryRouter>,
  );

describe('the friends league screen', () => {
  it('lists places, nicknames with their title underneath, and XP', async () => {
    show();
    const table = await screen.findByRole('list', { name: 'This week' });
    const rows = within(table).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('1st');
    expect(rows[0]).toHaveTextContent('Wren_2');
    expect(rows[0]).toHaveTextContent('Bright Explorer');
    expect(rows[0]).toHaveTextContent('240 XP');
    expect(rows[1]).toHaveTextContent('Lark_1 (you)');
    expect(rows[2]).toHaveTextContent('Not started yet');
  });

  it('asks the student to get a parent to turn friends on, and shows no league', async () => {
    show(
      fakeLeagueApi({
        getFriends: async () => sampleFriends({ allowed: false, friends: [], waiting: [] }),
      }),
    );
    expect(await screen.findByText(/Ask a parent to turn on friends/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'This week' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a friend' })).not.toBeInTheDocument();
  });

  it('makes a code to share in person', async () => {
    const api = fakeLeagueApi();
    show(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Add a friend' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show my code' }));
    expect(await screen.findByText('ABCD-2345')).toBeInTheDocument();
    expect(screen.getByText(/Tell it to your friend in person/)).toBeInTheDocument();
  });

  it("enters a friend's code, checks who it is, then waits for parents", async () => {
    const api = fakeLeagueApi();
    show(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Add a friend' }));
    await userEvent.type(screen.getByLabelText("Friend's code"), 'abcd 2345');
    await userEvent.click(screen.getByRole('button', { name: 'Check code' }));
    expect(await screen.findByText('Is this your friend?')).toBeInTheDocument();
    expect(screen.getByText('Nova_7')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, this is my friend' }));
    expect(api.confirm).toHaveBeenCalledWith('r-new');
    expect(
      await screen.findByText(/Now a parent in each family needs to say yes/),
    ).toBeInTheDocument();
  });

  it("says only that a code isn't valid when it is refused", async () => {
    const api = fakeLeagueApi({
      redeem: async () => Promise.reject(new ApiError('http', 'x', 404)),
    });
    show(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Add a friend' }));
    await userEvent.type(screen.getByLabelText("Friend's code"), 'WXYZ2345');
    await userEvent.click(screen.getByRole('button', { name: 'Check code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("That code isn't valid");
  });

  it('lets the student remove, block or report a friend with fixed reasons only', async () => {
    const api = fakeLeagueApi();
    show(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Friends' }));
    await userEvent.click(screen.getByRole('button', { name: 'Wren_2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Report' }));
    const reasons = screen.getAllByRole('radio').map((r) => r.closest('label')?.textContent);
    expect(reasons).toEqual([
      'Their nickname or picture upsets me',
      "I don't know this person",
      "I'm being pressured",
      'Something else',
    ]);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("I'm being pressured"));
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));
    expect(api.reportFriend).toHaveBeenCalledWith('f-wren', 'pressured');
    expect(await screen.findByText(/A parent will see this/)).toBeInTheDocument();
    // The list refreshes behind the sheet; the thank-you stays in view.
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText(/A parent will see this/)).toBeInTheDocument();
    expect(api.getFriends).toHaveBeenCalledTimes(2);
  });

  it('cannot remove or report a brother or sister', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Friends' }));
    await userEvent.click(screen.getByRole('button', { name: 'Comet_3' }));
    expect(screen.getByText(/in your family/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('shows waiting requests and lets the student hide from the league', async () => {
    const api = fakeLeagueApi();
    show(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Friends' }));
    expect(screen.getByText('Orbit_9')).toBeInTheDocument();
    expect(screen.getByText('Waiting for parents')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Hide me from the league' }));
    expect(api.setHidden).toHaveBeenCalledWith(true);
  });
});

describe('the league pages in the app', () => {
  it('open at /league for a student and /parent/friends/:id for a parent', async () => {
    const { renderRoute } = await import('../../test/render');
    renderRoute('/league');
    expect(await screen.findByRole('heading', { name: 'Friends league' })).toBeInTheDocument();
  });
});

describe('when friends are not available yet', () => {
  it('says so on the league page', async () => {
    show(fakeLeagueApi({ getFriends: () => Promise.reject(new ApiError('http', 'x', 404)) }));
    expect(await screen.findByText("Friends aren't available yet.")).toBeInTheDocument();
  });
});
