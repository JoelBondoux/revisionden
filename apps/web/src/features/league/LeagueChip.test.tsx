import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LeagueChip } from './LeagueChip';
import { fakeLeagueApi } from './fakeApi';
import { sampleLeague } from './fixtures';
import { AVATAR } from './fixtures';

const show = (api = fakeLeagueApi()) =>
  render(
    <MemoryRouter>
      <LeagueChip api={api} />
    </MemoryRouter>,
  );

describe('the league rank chip', () => {
  it("says the student's place this week and opens the league", async () => {
    show();
    const link = await screen.findByRole('link', { name: "You're 2nd this week" });
    expect(link).toHaveAttribute('href', '/league');
  });

  it('says when the student has not started this week', async () => {
    show(
      fakeLeagueApi({
        getLeague: async () =>
          sampleLeague({
            entries: [
              {
                nickname: 'A',
                avatarCode: AVATAR,
                title: null,
                xp: 50,
                place: 1,
                winning: false,
                you: false,
              },
              {
                nickname: 'Me',
                avatarCode: AVATAR,
                title: null,
                xp: 0,
                place: null,
                winning: false,
                you: true,
              },
            ],
          }),
      }),
    );
    expect(
      await screen.findByRole('link', { name: 'League: not started this week' }),
    ).toBeInTheDocument();
  });

  it('shows nothing with no friends, when hidden, or when it cannot load', async () => {
    const empty = show(fakeLeagueApi({ getLeague: async () => sampleLeague({ entries: [] }) }));
    await new Promise((r) => setTimeout(r, 0));
    expect(empty.container).toBeEmptyDOMElement();
    empty.unmount();
    const failing = show(fakeLeagueApi({ getLeague: async () => Promise.reject(new Error('x')) }));
    await new Promise((r) => setTimeout(r, 0));
    expect(failing.container).toBeEmptyDOMElement();
  });
});
