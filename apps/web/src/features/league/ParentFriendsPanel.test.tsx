import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParentFriendsPanel } from './ParentFriendsPanel';
import { fakeLeagueApi } from './fakeApi';
import { sampleParentFriends } from './fixtures';

const show = (api = fakeLeagueApi()) =>
  render(<ParentFriendsPanel api={api} studentId="s1" nickname="Lark_1" />);

describe("a parent's friends card for one child", () => {
  it('turns friends on or off', async () => {
    const api = fakeLeagueApi({
      getChildFriends: async () => sampleParentFriends({ allowed: false }),
    });
    show(api);
    await userEvent.click(
      await screen.findByRole('checkbox', { name: 'Allow friends for Lark_1' }),
    );
    expect(api.setAllowed).toHaveBeenCalledWith('s1', true);
  });

  it('approves or declines a waiting friend', async () => {
    const api = fakeLeagueApi();
    show(api);
    expect(await screen.findByText('Orbit_9')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve Orbit_9' }));
    expect(api.approve).toHaveBeenCalledWith('s1', 'r-1');
    await userEvent.click(screen.getByRole('button', { name: 'Decline Orbit_9' }));
    expect(api.decline).toHaveBeenCalledWith('s1', 'r-1');
  });

  it('shows friends with the private label, and removes, blocks and unblocks', async () => {
    const api = fakeLeagueApi();
    show(api);
    expect(await screen.findByText('from football')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Wren_2' }));
    expect(api.parentRemove).toHaveBeenCalledWith('s1', 'f-wren');
    await userEvent.click(screen.getByRole('button', { name: 'Block Wren_2' }));
    expect(api.parentBlock).toHaveBeenCalledWith('s1', 'f-wren');
    await userEvent.click(screen.getByRole('button', { name: 'Unblock Ember_8' }));
    expect(api.unblock).toHaveBeenCalledWith('s1', 'b-1');
  });

  it('saves a private label', async () => {
    const api = fakeLeagueApi();
    show(api);
    const box = await screen.findByLabelText('Private label for Wren_2');
    await userEvent.clear(box);
    await userEvent.type(box, 'from chess');
    await userEvent.click(screen.getByRole('button', { name: 'Save label for Wren_2' }));
    expect(api.setLabel).toHaveBeenCalledWith('s1', 'f-wren', 'from chess');
  });

  it('shows reports with the fixed reason and nicknames', async () => {
    show();
    expect(
      await screen.findByText(/Lark_1 reported Ember_8: I'm being pressured/),
    ).toBeInTheDocument();
  });
});

describe('closing a report', () => {
  it("lets the reporting child's parent mark it as dealt with", async () => {
    const api = fakeLeagueApi();
    show(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as dealt with' }));
    expect(api.closeReport).toHaveBeenCalledWith('s1', 'rep-1');
  });

  it('shows a closed report as dealt with, with no button', async () => {
    const base = sampleParentFriends();
    show(
      fakeLeagueApi({
        getChildFriends: async () => ({
          ...base,
          reports: base.reports.map((r) => ({ ...r, closed: true })),
        }),
      }),
    );
    expect(await screen.findByText(/dealt with/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark as dealt with' })).not.toBeInTheDocument();
  });
});

describe('the parent friends page', () => {
  it('opens from the parent home link with the child named', async () => {
    const { renderRoute } = await import('../../test/render');
    renderRoute('/parent/friends/00000000-0000-4000-8000-0000000000a1?name=demo_fox');
    expect(
      await screen.findByRole('checkbox', { name: 'Allow friends for demo_fox' }),
    ).toBeChecked();
  });
});

describe('the parent card when friends are not available yet', () => {
  it('shows no switch, only a short note', async () => {
    const { ApiError } = await import('../../api/client');
    render(
      <ParentFriendsPanel
        api={fakeLeagueApi({
          getChildFriends: () => Promise.reject(new ApiError('http', 'x', 404)),
        })}
        studentId="s1"
      />,
    );
    expect(await screen.findByText("Friends aren't available yet.")).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
