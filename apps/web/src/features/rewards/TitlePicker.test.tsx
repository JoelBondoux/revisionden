import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StudentTitleResponse, TitleChoice } from '@revisionden/core';
import { TitlePicker, type TitleApi } from './TitlePicker';

const word = (text: string, part: 'first' | 'last') => ({
  text,
  part,
  rewardId: `r-${text}`,
  rarity: 'common' as const,
});

const view = (over: Partial<StudentTitleResponse> = {}): StudentTitleResponse => ({
  nickname: 'quiet_fox',
  first: 'Fresh',
  last: 'Starter',
  title: 'Fresh Starter',
  words: {
    first: [word('Fresh', 'first'), word('Cosmic', 'first')],
    last: [word('Starter', 'last'), word('Scholar', 'last')],
  },
  ...over,
});

function fakeApi(over: Partial<TitleApi> = {}): TitleApi {
  return {
    getMyTitle: async () => view(),
    setMyTitle: async (choice: TitleChoice) =>
      view({ ...choice, title: [choice.first, choice.last].filter(Boolean).join(' ') || null }),
    ...over,
  };
}

describe('Title picker (two-part titles)', () => {
  it('shows the title under the nickname', async () => {
    render(<TitlePicker api={fakeApi()} />);
    expect(await screen.findByText('quiet_fox')).toBeInTheDocument();
    expect(screen.getByText('Fresh Starter')).toBeInTheDocument();
  });

  it('offers only unlocked words and saves a new pair for free', async () => {
    const setMyTitle = vi.fn(fakeApi().setMyTitle);
    render(<TitlePicker api={fakeApi({ setMyTitle })} />);
    const first = await screen.findByRole('combobox', { name: 'First word' });
    expect(Array.from((first as HTMLSelectElement).options).map((o) => o.textContent)).toEqual([
      'None',
      'Fresh',
      'Cosmic',
    ]);
    await userEvent.selectOptions(first, 'Cosmic');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Last word' }), 'Scholar');
    await userEvent.click(screen.getByRole('button', { name: 'Save title' }));
    expect(setMyTitle).toHaveBeenCalledWith({ first: 'Cosmic', last: 'Scholar' });
    expect(await screen.findByText('Cosmic Scholar')).toBeInTheDocument();
  });

  it('explains how to unlock words when there are none yet', async () => {
    render(
      <TitlePicker
        api={fakeApi({
          getMyTitle: async () =>
            view({ first: null, last: null, title: null, words: { first: [], last: [] } }),
        })}
      />,
    );
    expect(await screen.findByText(/Earn rewards to unlock title words/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save title' })).not.toBeInTheDocument();
  });

  it('says so when saving fails', async () => {
    render(
      <TitlePicker
        api={fakeApi({
          setMyTitle: async () => {
            throw new Error('nope');
          },
        })}
      />,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Save title' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save your title");
  });
});
