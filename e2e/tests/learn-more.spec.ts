import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Learn more (Q6): after a wrong answer, the free lessons for the question's learning point,
 * tucked behind a tap. Real content (content/learn-links/gcse-maths-h-n4.json: Oak's LCM and HCF
 * lesson for gcse-maths-h-n4-lp-hcf); the API is stubbed.
 */

const ITEM = {
  id: '00000000-0000-4000-8000-00000000e2e1',
  topicId: 'gcse-maths-h-n4',
  topicTitle: 'Primes, factors, multiples, HCF and LCM',
  draft: false,
  learningPoint: 'gcse-maths-h-n4-lp-hcf',
  type: 'multiple_choice',
  prompt: 'What is the highest common factor of 12 and 18?',
  options: ['2', '3', '6', '36'],
};

const WRONG = {
  id: '00000000-0000-4000-8000-00000000e2e2',
  itemId: ITEM.id,
  correct: false,
  score: 0,
  xpEarned: 0,
  createdAt: '2026-11-26T10:00:00.000Z',
  feedback: { correctAnswer: '6' },
  progress: {
    xpToday: 0,
    totalXp: 0,
    dailyGoalXp: 50,
    goalMet: false,
    streak: { current: 0, best: 0, skipDays: 0 },
  },
  flashcardAdded: false,
  newlyEarned: [],
};

/** A virtual passkey device (Chromium only), optionally holding one RevisionDen passkey. */
async function virtualPasskeyDevice(page: Page, rpId: string, withPasskey: boolean) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  const credentialId = Buffer.from('e2e-passkey-1').toString('base64');
  if (withPasskey) {
    const { generateKeyPairSync } = await import('node:crypto');
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    await cdp.send('WebAuthn.addCredential', {
      authenticatorId,
      credential: {
        credentialId,
        isResidentCredential: true,
        rpId,
        privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
        userHandle: Buffer.from('e2e-device').toString('base64'),
        signCount: 0,
      },
    });
  }
  return { credentialId: Buffer.from('e2e-passkey-1').toString('base64url') };
}

async function routeUnlock(page: Page, rpId: string) {
  let verified: { response?: { id?: string } } | undefined;
  await page.route('**/v1/device/unlock/options', (route) =>
    route.fulfill({
      json: {
        challengeId: 'c1',
        options: {
          challenge: 'ZTJlLWNoYWxsZW5nZQ',
          rpId,
          timeout: 5000,
          userVerification: 'preferred',
        },
      },
    }),
  );
  await page.route('**/v1/device/unlock/verify', async (route) => {
    verified = route.request().postDataJSON() as typeof verified;
    await route.fulfill({
      json: {
        student: {
          id: '8f6d2b1e-4c3a-4d5e-9f00-000000000001',
          nickname: 'NovaFox',
          avatarCode: '10000000000000000000000000000',
          yearGroup: 11,
        },
      },
    });
  });
  return () => verified;
}

async function wrongAnswerFeedback(page: Page, baseURL: string) {
  const rpId = new URL(baseURL).hostname;
  await virtualPasskeyDevice(page, rpId, true);
  await routeUnlock(page, rpId);
  await page.route('**/v1/student/learn/lesson**', (route) =>
    route.fulfill({ json: { items: [ITEM], draftContent: false } }),
  );
  await page.route('**/v1/student/recall**', (route) =>
    route.fulfill({ json: { items: [], draftContent: false } }),
  );
  await page.route('**/v1/student/learn/attempts', (route) => route.fulfill({ json: WRONG }));
  await page.goto('/');
  await page.getByRole('button', { name: "I'm a student: unlock with my passkey" }).click();
  // Unlocking lands on Home (J15b).
  await expect(page).toHaveURL(/\/home$/);
  // Into the lesson without a reload (the unlocked session lives in the page).
  await page.evaluate(() => {
    window.history.pushState({}, '', '/learn/topic/gcse-maths-h-n4');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  // Tap the answer's label, as a student does (the radio itself sits under it).
  await page.getByText('3', { exact: true }).click();
  await expect(page.getByRole('radio', { name: '3', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Check' }).click();
  const feedback = page.getByRole('status', { name: 'Answer feedback' });
  await expect(feedback).toBeVisible();
  return feedback;
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

async function sidewaysOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test("Learn more after a wrong answer opens the learning point's lesson, requesting nothing until tapped", async ({
  page,
  baseURL,
}) => {
  const feedback = await wrongAnswerFeedback(page, baseURL!);
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  const button = feedback.getByRole('button', { name: 'Learn more' });
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await button.click();
  const link = feedback.getByRole('link', {
    name: /Checking and securing understanding of LCM and HCF/,
  });
  await expect(link).toHaveAttribute(
    'href',
    'https://www.thenational.academy/teachers/programmes/maths-secondary-ks4-higher/units/arithmetic-procedures-index-laws/lessons/checking-and-securing-understanding-of-lcm-and-hcf',
  );
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  // Opening the list loads nothing from the provider, and nothing about the tap is sent.
  const origin = new URL(page.url()).origin;
  expect(requests.filter((u) => new URL(u).origin !== origin || u.includes('/v1/'))).toEqual([]);
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
  await expectAccessible(page);
});

test.describe('on a 320px screen with text at 200%', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('Learn more fits: no sideways scroll and every link inside the screen', async ({
    page,
    baseURL,
  }) => {
    const feedback = await wrongAnswerFeedback(page, baseURL!);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await feedback.getByRole('button', { name: 'Learn more' }).click();
    await expect(feedback.getByRole('link').first()).toBeVisible();
    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
    const tooWide = await page
      .locator('.learn-first__toggle, .learn-first__link')
      .evaluateAll((els) =>
        els
          .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5)
          .map((el) => el.textContent?.trim()),
      );
    expect(tooWide).toEqual([]);
  });
});
