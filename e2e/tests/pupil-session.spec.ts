import { generateKeyPairSync } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { WCAG_TAGS, axeWhenSettled } from './support/axe';
import topicMap from './fixtures/topic-map-gcse-maths.json' with { type: 'json' };

/*
 * W14: one whole pupil session on a phone, as a smoke test of the pieces working together. The
 * pupil unlocks with a passkey (a real WebAuthn prompt answered by Chromium's virtual
 * authenticator), lands on Home, opens the map, starts the "You are here" topic, answers a
 * question, opens the prize box it earns, collects, and goes back Home. Every screen passes axe
 * (WCAG 2.2 A and AA) once its animations settle. The API is stubbed: a made-up pupil, a made-up
 * question (not educational content) and a real catalogue reward id.
 */

const STUDENT = {
  id: '00000000-0000-4000-8000-0000000000e1',
  nickname: 'TestFox',
  avatarCode: '1' + '0'.repeat(28),
  yearGroup: 11,
};
const LESSON_ID = topicMap.nextMission.lessonId;
const ITEM_ID = '00000000-0000-4000-8000-000000000e11';

test.skip(({ isMobile }) => !isMobile, 'a phone smoke test (the phone project)');

/** A virtual authenticator holding one RevisionDen passkey for this site. */
async function passkeyOnThisPhone(page: Page, rpId: string) {
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
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  await cdp.send('WebAuthn.addCredential', {
    authenticatorId,
    credential: {
      credentialId: Buffer.from('e2e-pupil-passkey').toString('base64'),
      isResidentCredential: true,
      rpId,
      privateKey: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
      userHandle: Buffer.from('e2e-pupil').toString('base64'),
      signCount: 0,
    },
  });
}

/** The API a pupil's session touches, stubbed; anything else answers 404. */
async function stubApi(page: Page, rpId: string) {
  const calls = { unlocked: false, answered: false };
  await page.route('**/v1/**', (route) => route.fulfill({ status: 404, json: { error: 'none' } }));
  await page.route('**/v1/client-errors', (route) => route.fulfill({ status: 204 }));
  await page.route('**/v1/device/unlock/options', (route) =>
    route.fulfill({
      json: {
        challengeId: 'e2e-unlock',
        options: {
          challenge: Buffer.from('e2e-unlock-challenge').toString('base64url'),
          rpId,
          allowCredentials: [],
          userVerification: 'required',
          timeout: 5000,
        },
      },
    }),
  );
  await page.route('**/v1/device/unlock/verify', (route) => {
    calls.unlocked = true;
    return route.fulfill({ json: { student: STUDENT, deviceMarker: 'e2e-device' } });
  });
  await page.route('**/v1/student/avatar', (route) =>
    route.fulfill({ json: { avatarCode: STUDENT.avatarCode, earnedRewardIds: [] } }),
  );
  await page.route('**/v1/student/map**', (route) => route.fulfill({ json: topicMap }));
  await page.route('**/v1/student/cards/due', (route) => route.fulfill({ json: { due: 0 } }));
  await page.route('**/v1/student/learn/lesson**', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: ITEM_ID,
            topicId: LESSON_ID,
            topicTitle: 'Demo topic',
            draft: false,
            type: 'short_answer',
            prompt: 'Demo question',
          },
        ],
        draftContent: false,
      },
    }),
  );
  await page.route('**/v1/student/learn/attempts', (route) => {
    calls.answered = true;
    return route.fulfill({
      json: {
        id: '00000000-0000-4000-8000-000000000e12',
        itemId: ITEM_ID,
        correct: true,
        score: 1,
        xpEarned: 10,
        createdAt: '2026-11-26T10:00:00.000Z',
        feedback: { correctAnswer: 'demo' },
        progress: {
          xpToday: 10,
          totalXp: 10,
          dailyGoalXp: 50,
          goalMet: false,
          streak: { current: 7, best: 7, skipDays: 0 },
        },
        flashcardAdded: false,
        combo: 1,
        comboBonusXp: 0,
        newlyEarned: [
          {
            id: 'streak-7',
            name: '7-day streak',
            rarity: 'common',
            items: [],
            earned: true,
            current: 7,
            target: 7,
          },
        ],
      },
    });
  });
  return calls;
}

/** No WCAG 2.2 A or AA problem axe can find, once the screen's animations have settled. */
async function expectAccessible(page: Page, where: string, dialogOnly = false) {
  const results = await axeWhenSettled(
    page,
    dialogOnly ? (axe) => axe.include('dialog').withTags(WCAG_TAGS) : undefined,
  );
  expect(
    results.violations.map((v) => `${v.id}: ${v.help}`),
    `axe on ${where}`,
  ).toEqual([]);
}

test('a pupil unlocks, follows the map to a lesson, earns a prize and goes back Home', async ({
  page,
  baseURL,
}) => {
  const rpId = new URL(baseURL!).hostname;
  await passkeyOnThisPhone(page, rpId);
  const calls = await stubApi(page, rpId);

  // Sign in: the welcome page's student button answers the passkey prompt and lands on Home.
  await page.goto('/');
  await expectAccessible(page, 'the welcome page');
  await page.getByRole('button', { name: "I'm a student: unlock with my passkey" }).click();
  await expect(page).toHaveURL(/\/home$/);
  expect(calls.unlocked).toBe(true);
  await expect(page.getByRole('link', { name: /^Go:/ })).toBeVisible();
  await expectAccessible(page, 'Home');

  // The map opens on the current unit; "You are here" starts that topic's lesson.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Map' }).click();
  await expect(page.getByRole('group', { name: 'Units' })).toBeVisible();
  await expectAccessible(page, 'the map');
  // The current node bobs for as long as it is on screen (by design), so tap it without waiting
  // for it to hold still.
  await page.getByRole('link', { name: /you are here$/ }).click({ force: true });
  await expect(page).toHaveURL(new RegExp(`/learn/topic/${LESSON_ID}$`));
  await expect(page.getByLabel('Your answer')).toBeVisible();
  await expectAccessible(page, 'the lesson');

  // A right answer earns a reward, which arrives in the prize box.
  await page.getByLabel('Your answer').fill('demo');
  await page.getByRole('button', { name: 'Check' }).click();
  expect(calls.answered).toBe(true);
  const box = page.getByRole('dialog');
  await expect(box.getByRole('heading', { name: 'A prize box!' })).toBeVisible();
  await box.getByRole('button', { name: 'Open the prize box' }).click();
  await expect(box.getByRole('listitem')).toContainText('7-day streak');
  await expect(box.getByRole('button', { name: 'Collect' })).toBeFocused();
  await expectAccessible(page, 'the prize box', true);
  await box.getByRole('button', { name: 'Collect' }).click();
  await expect(box).toBeHidden();
  await expectAccessible(page, 'the lesson after the prize');

  // Pip goes back Home, checking first, since the lesson is still open.
  await page.getByRole('button', { name: 'Home' }).click();
  await page
    .getByRole('dialog', { name: 'Leave this lesson?' })
    .getByRole('button', { name: 'Leave' })
    .click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('link', { name: /^Go:/ })).toBeVisible();
  await expectAccessible(page, 'Home, back from the lesson');
});
