import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { DEFAULT_AVATAR, encodeAvatar } from '@revisionden/core';
import { StudentProvider } from '../../session/StudentContext';
import type { OnboardingApi } from './api';
import { OnboardingApiError } from './api';
import { fakeOnboardingApi } from '../../test/fakeOnboardingApi';
import { LinkPage, type LinkEnv } from './LinkPage';
import { OnboardingApiProvider } from './OnboardingApiContext';
import { collectDeviceDetails } from '../feedback/details';

/** E8: why a passkey set-up failed, browsers that cannot make one, and trying again. */
const STUDENT = {
  id: '11111111-1111-4111-8111-111111111111',
  nickname: 'Comet_7',
  avatarCode: encodeAvatar(DEFAULT_AVATAR),
  yearGroup: 11,
};

const CHROME =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const GOOGLE_APP = `${CHROME} GSA/15.47.30.29.arm64`;
const PAGE =
  'https://dev.revisionden.test/link?token=tttttttttttttttttttttttttttttttt&family=family-1';

const dom = (name: string) => Object.assign(new Error('browser text'), { name });

let challenges = 0;
function fakeApi(overrides: Partial<OnboardingApi> = {}): OnboardingApi {
  return fakeOnboardingApi({
    redeemLink: vi.fn(async () => {
      challenges += 1;
      return {
        challengeId: `challenge-${challenges}`,
        options: { challenge: `c${challenges}` },
        student: { nickname: STUDENT.nickname, avatarCode: STUDENT.avatarCode },
      };
    }),
    verifyLink: vi.fn(async () => ({ deviceId: 'device-1', student: STUDENT })),
    reportPasskeyError: vi.fn(() => 'RD-7K2M9Q'),
    ...overrides,
  });
}

function renderLink(
  api: OnboardingApi,
  register: (options: Record<string, unknown>) => Promise<unknown>,
  env: Partial<LinkEnv> = {},
) {
  const fullEnv: LinkEnv = {
    userAgent: CHROME,
    hasWebAuthn: true,
    screenLock: async () => true,
    pageUrl: () => PAGE,
    copy: vi.fn(async () => undefined),
    now: () => 0,
    ...env,
  };
  const router = createMemoryRouter(
    [
      {
        path: '/link',
        element: <LinkPage register={register} deviceType={() => 'phone'} env={fullEnv} />,
      },
      { path: '/unlock', element: <h1>Unlock</h1> },
      { path: '/welcome/privacy', element: <h1>Privacy notice for young people</h1> },
    ],
    { initialEntries: ['/link?token=tttttttttttttttttttttttttttttttt&family=family-1'] },
  );
  render(
    <StudentProvider storage={{ getItem: () => null, setItem: () => undefined }}>
      <OnboardingApiProvider api={api}>
        <RouterProvider router={router} />
      </OnboardingApiProvider>
    </StudentProvider>,
  );
  return { env: fullEnv, router };
}

const setUpButton = () => screen.findByRole('button', { name: 'Set up passkey' });

describe('LinkPage: when the passkey cannot be set up', () => {
  it('says why in plain words, shows the error name and reports it without personal data', async () => {
    const api = fakeApi();
    const user = userEvent.setup();
    renderLink(api, vi.fn().mockRejectedValueOnce(dom('NotAllowedError')));
    await user.click(await setUpButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Setting up the passkey was cancelled or took too long. Try again.',
    );
    expect(screen.getByText('Details: NotAllowedError (RD-7K2M9Q)')).toBeInTheDocument();
    expect(api.reportPasskeyError).toHaveBeenCalledWith('NotAllowedError');
    // A bug report sent from here carries the same name and reference.
    expect(
      collectDeviceDetails({
        appVersion: '1',
        route: '/link',
        userAgent: '',
        width: 1,
        height: 1,
        online: true,
      }).lastProblem,
    ).toBe('passkey:NotAllowedError:RD-7K2M9Q');
  });

  it('gets a fresh challenge after a failure, so Try again uses it', async () => {
    const api = fakeApi();
    const register = vi
      .fn()
      .mockRejectedValueOnce(dom('AbortError'))
      .mockResolvedValueOnce({ id: 'cred-1', response: {} });
    const user = userEvent.setup();
    renderLink(api, register);
    await user.click(await setUpButton());
    await screen.findByRole('alert');
    await user.click(await setUpButton());
    const second = vi.mocked(api.redeemLink).mock.results[1]!.value as Promise<{
      challengeId: string;
    }>;
    expect(api.verifyLink).toHaveBeenCalledWith(
      expect.objectContaining({ challengeId: (await second).challengeId }),
    );
    expect(await screen.findByRole('heading', { name: 'Make it yours' })).toBeInTheDocument();
  });

  it('fetches fresh options when the challenge has expired before the tap', async () => {
    const api = fakeApi();
    let now = 0;
    const register = vi.fn<(options: Record<string, unknown>) => Promise<unknown>>(async () => ({
      id: 'cred-1',
      response: {},
    }));
    const user = userEvent.setup();
    renderLink(api, register, { now: () => now });
    const button = await setUpButton();
    now = 6 * 60 * 1000;
    await user.click(button);
    expect(api.redeemLink).toHaveBeenCalledTimes(2);
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0]![0]).not.toEqual(
      (await (vi.mocked(api.redeemLink).mock.results[0]!.value as Promise<{ options: unknown }>))
        .options,
    );
  });

  it('asks for a screen lock when the device has none', async () => {
    const user = userEvent.setup();
    renderLink(fakeApi(), vi.fn().mockRejectedValueOnce(dom('ConstraintError')));
    await user.click(await setUpButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This device needs a screen lock first.',
    );
  });

  it('warns before the tap when the device has no screen lock', async () => {
    renderLink(fakeApi(), vi.fn(), { screenLock: async () => false });
    expect(
      await screen.findByText(
        'This device may not have a screen lock. A passkey needs a PIN, pattern, fingerprint or face unlock.',
      ),
    ).toBeInTheDocument();
  });

  it('offers unlock instead when this device already has a passkey for the child', async () => {
    const user = userEvent.setup();
    renderLink(
      fakeApi(),
      vi.fn().mockRejectedValueOnce(
        Object.assign(dom('InvalidStateError'), {
          code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED',
        }),
      ),
    );
    await user.click(await setUpButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This device already has a passkey for you.',
    );
    expect(screen.getByRole('link', { name: /Unlock with my passkey/ })).toHaveAttribute(
      'href',
      '/unlock',
    );
  });

  it('asks for Chrome when the browser cannot make passkeys', async () => {
    const user = userEvent.setup();
    renderLink(fakeApi(), vi.fn().mockRejectedValueOnce(dom('NotSupportedError')));
    await user.click(await setUpButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Open this page in Chrome');
  });

  it('stops when the server says the link was cancelled, with nothing to retry', async () => {
    const api = fakeApi({
      verifyLink: vi.fn(async () => {
        throw new OnboardingApiError('link_cancelled', 'This link was cancelled.', 400);
      }),
    });
    const user = userEvent.setup();
    renderLink(
      api,
      vi.fn(async () => ({ id: 'cred-1', response: {} })),
    );
    await user.click(await setUpButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This link no longer works. Ask a parent to make a new one.',
    );
    expect(screen.queryByRole('button', { name: 'Set up passkey' })).toBeNull();
    expect(api.reportPasskeyError).toHaveBeenCalledWith('link_cancelled');
  });
});

describe('LinkPage: before the tap', () => {
  it('asks to open the page in Chrome from an in-app browser, with Copy link and a Chrome link', async () => {
    const user = userEvent.setup();
    const { env } = renderLink(fakeApi(), vi.fn(), { userAgent: GOOGLE_APP });
    expect(
      await screen.findByRole('heading', { name: 'Open this page in Chrome' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in Chrome' })).toHaveAttribute(
      'href',
      'intent://dev.revisionden.test/link?token=tttttttttttttttttttttttttttttttt&family=family-1#Intent;scheme=https;package=com.android.chrome;end',
    );
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(env.copy).toHaveBeenCalledWith(PAGE);
    expect(await screen.findByText('Link copied. Paste it into Chrome.')).toBeInTheDocument();
    // The child can still try here.
    expect(screen.getByRole('button', { name: 'Set up passkey' })).toBeInTheDocument();
  });

  it('asks for another browser when this one has no passkeys at all', async () => {
    renderLink(fakeApi(), vi.fn(), { hasWebAuthn: false, userAgent: CHROME });
    expect(
      await screen.findByRole('heading', { name: 'Open this page in Chrome' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set up passkey' })).toBeNull();
  });
});
