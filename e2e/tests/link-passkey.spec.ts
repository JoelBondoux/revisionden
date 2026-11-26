import { expect, test, type Page } from '@playwright/test';

/**
 * E8: a child's device sets up its passkey from a parent's link, in a real browser with a
 * virtual authenticator (Chromium only). The API is stubbed; the browser's WebAuthn is real.
 */
const STUDENT = {
  id: '8f6d2b1e-4c3a-4d5e-9f00-000000000001',
  nickname: 'NovaFox',
  avatarCode: '10000000000000000000000000000',
  yearGroup: 11,
};

async function virtualAuthenticator(page: Page, isUserVerified: boolean) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified,
      automaticPresenceSimulation: true,
    },
  });
}

/** Stubs the link API; counts how many times the page opened the link. */
async function routeLink(page: Page, rpId: string) {
  let opened = 0;
  let verified: { challengeId?: string; response?: { id?: string } } | undefined;
  await page.route('**/v1/device/link', (route) => {
    opened += 1;
    return route.fulfill({
      json: {
        challengeId: `c${opened}`,
        options: {
          challenge: Buffer.from(`e2e-challenge-${opened}`).toString('base64url'),
          rp: { name: 'RevisionDen', id: rpId },
          user: {
            id: Buffer.from('e2e-student').toString('base64url'),
            name: STUDENT.nickname,
            displayName: STUDENT.nickname,
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          timeout: 5000,
          attestation: 'none',
          authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        },
        student: { nickname: STUDENT.nickname, avatarCode: STUDENT.avatarCode },
      },
    });
  });
  await page.route('**/v1/device/link/verify', async (route) => {
    verified = route.request().postDataJSON() as typeof verified;
    await route.fulfill({ status: 201, json: { deviceId: 'device-1', student: STUDENT } });
  });
  await page.route('**/v1/client-errors', (route) => route.fulfill({ status: 204 }));
  return { opened: () => opened, verified: () => verified };
}

const LINK = '/link?token=tttttttttttttttttttttttttttttttt&family=family-1';

test('a child sets up a passkey from a link and goes on to Make it yours', async ({
  page,
  baseURL,
}) => {
  const rpId = new URL(baseURL!).hostname;
  await virtualAuthenticator(page, true);
  const api = await routeLink(page, rpId);
  await page.goto(LINK);
  await page.getByRole('button', { name: 'Set up passkey' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Make it yours' })).toBeVisible();
  expect(api.verified()?.challengeId).toBe('c1');
  expect(api.verified()?.response?.id).toBeTruthy();
});

test('a failed set-up says why in plain words, with the error name, and Try again works', async ({
  page,
  baseURL,
}) => {
  const rpId = new URL(baseURL!).hostname;
  await virtualAuthenticator(page, false);
  const api = await routeLink(page, rpId);
  await page.goto(LINK);
  await page.getByRole('button', { name: 'Set up passkey' }).click();
  await expect(page.getByRole('alert')).toContainText('Try again');
  await expect(page.getByText(/^Details: \w+ \(RD-[A-Z0-9]{6}\)$/)).toBeVisible();
  // The page fetched a fresh challenge after the failure, ready for Try again.
  expect(api.opened()).toBe(2);
});
