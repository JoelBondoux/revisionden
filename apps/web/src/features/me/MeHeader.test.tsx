import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_AVATAR, encodeAvatar, type Student } from '@revisionden/core';
import { OnboardingApiProvider } from '../onboarding/OnboardingApiContext';
import type { OnboardingApi } from '../onboarding/api';
import { MeHeader } from './MeHeader';
import { MyAvatarProvider, useMyAvatar } from './MyAvatarContext';

const START = encodeAvatar(DEFAULT_AVATAR);
const me: Student = {
  id: '00000000-0000-4000-8000-0000000000a1',
  nickname: 'NovaFox',
  avatarCode: START,
  yearGroup: 11,
};

function fakeApi(save = vi.fn(async (avatarCode: string) => ({ ...me, avatarCode }))) {
  const api = {
    getMe: vi.fn(async () => me),
    getMyAvatar: vi.fn(async () => ({ avatarCode: START, earnedRewardIds: [] })),
    saveMyAvatar: save,
  } as unknown as OnboardingApi;
  return { api, save };
}

/** Stands in for the nav's Me item: shows the code the rest of the app sees. */
function NavCode() {
  const avatar = useMyAvatar();
  return <span data-testid="nav-code">{avatar?.code ?? ''}</span>;
}

function renderHeader(api: OnboardingApi) {
  return render(
    <OnboardingApiProvider api={api}>
      <MyAvatarProvider studentId={me.id}>
        <MeHeader />
        <NavCode />
      </MyAvatarProvider>
    </OnboardingApiProvider>,
  );
}

async function openAndChange() {
  await userEvent.click(await screen.findByRole('button', { name: 'Edit my avatar' }));
  const sheet = screen.getByRole('dialog', { name: 'Edit my avatar' });
  // Pick the first item that is unlocked and not already worn.
  const other = sheet.querySelector<HTMLButtonElement>(
    '.avatar-option[aria-pressed="false"]:not([aria-disabled])',
  )!;
  await userEvent.click(other);
  return sheet;
}

describe('the Me header (W9)', () => {
  it('shows the student’s avatar, large, with their nickname', async () => {
    renderHeader(fakeApi().api);
    expect(await screen.findByText('NovaFox')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: "NovaFox's avatar" })).toBeInTheDocument();
  });

  it('saves a changed avatar and the nav avatar updates at once', async () => {
    const { api, save } = fakeApi();
    renderHeader(api);
    await openAndChange();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const saved = save.mock.calls[0]![0];
    expect(saved).not.toBe(START);
    await waitFor(() => expect(screen.getByTestId('nav-code')).toHaveTextContent(saved));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Avatar saved.')).toHaveAttribute('role', 'status');
  });

  it('closes straight away on Cancel when nothing changed', async () => {
    renderHeader(fakeApi().api);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit my avatar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks before throwing away changes, and can keep editing', async () => {
    const { api, save } = fakeApi();
    renderHeader(api);
    await openAndChange();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const ask = screen.getByRole('alertdialog', { name: 'Throw away your changes?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('dialog', { name: 'Edit my avatar' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Throw away' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-code')).toHaveTextContent(START);
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps the sheet open and says so when saving fails', async () => {
    const { api } = fakeApi(
      vi.fn(async () => {
        throw new Error('That avatar uses items not unlocked yet');
      }),
    );
    renderHeader(api);
    await openAndChange();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not unlocked yet');
    expect(screen.getByRole('dialog', { name: 'Edit my avatar' })).toBeInTheDocument();
    expect(screen.getByTestId('nav-code')).toHaveTextContent(START);
  });
});
