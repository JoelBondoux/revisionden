import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { LeagueTile, ParentFriendsTile } from './tiles';
import { fakeLeagueApi } from './fakeApi';

const notAvailable = () => Promise.reject(new ApiError('http', 'x', 404));
const settle = () => new Promise((r) => setTimeout(r, 0));
const inRouter = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('the friends tiles (behind the dev-only friends flag)', () => {
  it('shows the Friends league tile on Me when friends exist on this server', async () => {
    inRouter(
      <ul>
        <LeagueTile api={fakeLeagueApi()} />
      </ul>,
    );
    expect(await screen.findByRole('link', { name: /Friends league/ })).toHaveAttribute(
      'href',
      '/league',
    );
  });

  it('shows no tile when the server says friends are not available yet', async () => {
    const { container } = inRouter(
      <ul>
        <LeagueTile api={fakeLeagueApi({ getFriends: notAvailable })} />
      </ul>,
    );
    await settle();
    expect(container.querySelector('a')).toBeNull();
  });

  it("shows the parent's Friends tile only when friends exist on this server", async () => {
    inRouter(
      <ul>
        <ParentFriendsTile api={fakeLeagueApi()} studentId="s1" nickname="Lark_1" />
      </ul>,
    );
    expect(await screen.findByRole('link', { name: /Friends/ })).toHaveAttribute(
      'href',
      '/parent/friends/s1?name=Lark_1',
    );
    const off = inRouter(
      <ul>
        <ParentFriendsTile
          api={fakeLeagueApi({ getChildFriends: notAvailable })}
          studentId="s2"
          nickname="Wren_2"
        />
      </ul>,
    );
    await settle();
    expect(off.container.querySelector('a')).toBeNull();
  });
});
