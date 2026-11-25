import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { DEFAULT_AVATAR, encodeAvatar } from '@revisionden/core';
import { StudentProvider } from '../../session/StudentContext';
import type { OnboardingApi } from './api';
import { OnboardingApiError } from './api';
import { fakeOnboardingApi } from '../../test/fakeOnboardingApi';
import { LinkPage } from './LinkPage';
import { OnboardingApiProvider } from './OnboardingApiContext';

const STUDENT = {
  id: '11111111-1111-4111-8111-111111111111',
  nickname: 'Comet_7',
  avatarCode: encodeAvatar(DEFAULT_AVATAR),
  yearGroup: 11,
};

function fakeApi(overrides: Partial<OnboardingApi> = {}): OnboardingApi {
  return fakeOnboardingApi({
    redeemLink: vi.fn(async () => ({
      challengeId: 'challenge-1',
      options: { challenge: 'abc' },
      student: { nickname: STUDENT.nickname, avatarCode: STUDENT.avatarCode },
    })),
    verifyLink: vi.fn(async () => ({ deviceId: 'device-1', student: STUDENT })),
    ...overrides,
  });
}

function renderLink(
  api: OnboardingApi,
  register = vi.fn(async () => ({ id: 'cred-1', response: {} })),
  path = '/link?token=tttttttttttttttttttttttttttttttt&family=family-1',
) {
  const storage = new Map<string, string>();
  const router = createMemoryRouter(
    [
      { path: '/link', element: <LinkPage register={register} deviceType={() => 'phone'} /> },
      { path: '/learn', element: <h1>Learn</h1> },
      // A newly linked device shows the young people's privacy notice first (workstream L).
      { path: '/welcome/privacy', element: <h1>Privacy notice for young people</h1> },
    ],
    { initialEntries: [path] },
  );
  render(
    <StudentProvider
      storage={{
        getItem: (k) => storage.get(k) ?? null,
        setItem: (k, v) => void storage.set(k, v),
      }}
    >
      <OnboardingApiProvider api={api}>
        <RouterProvider router={router} />
      </OnboardingApiProvider>
    </StudentProvider>,
  );
  return { router, storage, register };
}

describe('LinkPage (student device)', () => {
  it('greets the student, sets up a passkey and shows the young people’s privacy notice', async () => {
    const api = fakeApi();
    const user = userEvent.setup();
    const { storage, register } = renderLink(api);
    expect(await screen.findByRole('heading', { name: 'Hi Comet_7!' })).toBeInTheDocument();
    expect(api.redeemLink).toHaveBeenCalledWith({
      token: 'tttttttttttttttttttttttttttttttt',
      familyId: 'family-1',
    });
    await user.click(screen.getByRole('button', { name: 'Set up passkey' }));
    expect(register).toHaveBeenCalledWith({ challenge: 'abc' });
    expect(api.verifyLink).toHaveBeenCalledWith({
      challengeId: 'challenge-1',
      response: { id: 'cred-1', response: {} },
      deviceType: 'phone',
    });
    expect(
      await screen.findByRole('heading', { name: 'Privacy notice for young people' }),
    ).toBeInTheDocument();
    expect(storage.get('revisionden.studentId')).toBe(STUDENT.id);
  });

  it('explains an expired or used code', async () => {
    const api = fakeApi({
      redeemLink: vi.fn(async () => {
        throw new OnboardingApiError(
          'invalid_link_token',
          'This code has expired or was already used. Ask a parent for a new one.',
          400,
        );
      }),
    });
    renderLink(api);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This code has expired or was already used. Ask a parent for a new one.',
    );
  });

  it('lets the student type the short code from a parent instead', async () => {
    const api = fakeApi();
    const user = userEvent.setup();
    renderLink(api, undefined, '/link');
    expect(await screen.findByRole('heading', { name: 'Link this device' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Code from your parent'), 'abcd efgh');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(api.redeemLink).toHaveBeenCalledWith({ code: 'ABCDEFGH' });
    expect(await screen.findByRole('heading', { name: 'Hi Comet_7!' })).toBeInTheDocument();
  });

  it('explains a code that cannot be right without asking the server', async () => {
    const api = fakeApi();
    const user = userEvent.setup();
    renderLink(api, undefined, '/link');
    await user.type(await screen.findByLabelText('Code from your parent'), 'ABC');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'That does not look like a code. It has 8 letters and numbers, like ABCD-EFGH.',
    );
    expect(api.redeemLink).not.toHaveBeenCalled();
  });

  it('says when a typed code has expired, and lets the student try another', async () => {
    const api = fakeApi({
      redeemLink: vi
        .fn()
        .mockRejectedValueOnce(
          new OnboardingApiError(
            'invalid_link_token',
            'This code has expired or was already used. Ask a parent for a new one.',
            400,
          ),
        )
        .mockResolvedValueOnce({
          challengeId: 'challenge-1',
          options: { challenge: 'abc' },
          student: { nickname: STUDENT.nickname, avatarCode: STUDENT.avatarCode },
        }),
    });
    const user = userEvent.setup();
    renderLink(api, undefined, '/link');
    await user.type(await screen.findByLabelText('Code from your parent'), 'ABCD-EFGH');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This code has expired or was already used.',
    );
    await user.clear(screen.getByLabelText('Code from your parent'));
    await user.type(screen.getByLabelText('Code from your parent'), 'WXYZ-2345');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Hi Comet_7!' })).toBeInTheDocument();
  });

  it('tells the server what kind of device this is, and nothing more', async () => {
    const api = fakeApi();
    const user = userEvent.setup();
    renderLink(api);
    await user.click(await screen.findByRole('button', { name: 'Set up passkey' }));
    expect(api.verifyLink).toHaveBeenCalledWith(expect.objectContaining({ deviceType: 'phone' }));
  });

  it('lets the student try again if the passkey set-up is cancelled', async () => {
    const register = vi
      .fn()
      .mockRejectedValueOnce(new Error('NotAllowedError'))
      .mockResolvedValueOnce({ id: 'cred-1', response: {} });
    const user = userEvent.setup();
    renderLink(fakeApi(), register);
    await user.click(await screen.findByRole('button', { name: 'Set up passkey' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The passkey was not set up. Try again.',
    );
    await user.click(screen.getByRole('button', { name: 'Set up passkey' }));
    expect(
      await screen.findByRole('heading', { name: 'Privacy notice for young people' }),
    ).toBeInTheDocument();
  });
});
