import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { DEFAULT_AVATAR, encodeAvatar } from '@revisionden/core';
import { StudentProvider } from '../../session/StudentContext';
import type { OnboardingApi } from './api';
import { OnboardingApiError } from './api';
import { LinkPage } from './LinkPage';
import { OnboardingApiProvider } from './OnboardingApiContext';

const STUDENT = {
  id: '11111111-1111-4111-8111-111111111111',
  nickname: 'Comet_7',
  avatarCode: encodeAvatar(DEFAULT_AVATAR),
  yearGroup: 11,
};

function fakeApi(overrides: Partial<OnboardingApi> = {}): OnboardingApi {
  return {
    getFamily: vi.fn(),
    addChild: vi.fn(),
    createLinkToken: vi.fn(),
    redeemLink: vi.fn(async () => ({
      challengeId: 'challenge-1',
      options: { challenge: 'abc' },
      student: { nickname: STUDENT.nickname, avatarCode: STUDENT.avatarCode },
    })),
    verifyLink: vi.fn(async () => ({ deviceId: 'device-1', student: STUDENT })),
    ...overrides,
  };
}

function renderLink(
  api: OnboardingApi,
  register = vi.fn(async () => ({ id: 'cred-1', response: {} })),
  path = '/link?token=tttttttttttttttttttttttttttttttt&family=family-1',
) {
  const storage = new Map<string, string>();
  const router = createMemoryRouter(
    [
      { path: '/link', element: <LinkPage register={register} /> },
      { path: '/learn', element: <h1>Learn</h1> },
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
  it('greets the student, sets up a passkey and opens Learn', async () => {
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
    });
    expect(await screen.findByRole('heading', { name: 'Learn' })).toBeInTheDocument();
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

  it('needs a code in the link', async () => {
    renderLink(fakeApi(), undefined, '/link');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This link is missing its code. Scan the QR code again.',
    );
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
    expect(await screen.findByRole('heading', { name: 'Learn' })).toBeInTheDocument();
  });
});
