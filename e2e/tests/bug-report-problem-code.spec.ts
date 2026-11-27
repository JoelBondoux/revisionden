import { expect, test } from '@playwright/test';

/*
 * F18: when a screen shows an error's reference code and the pupil then reports a bug, the code
 * is named on the form ("Problem code: RD-…") and sent with the device details. The API is
 * stubbed: every call fails with one made-up code, except the bug report itself.
 */

const REF = 'RD-VDMW5E';

test('a reference code on screen goes into the next bug report', async ({ page }) => {
  const sent: { device?: { lastProblem?: string } }[] = [];
  await page.addInitScript(() =>
    localStorage.setItem('revisionden.studentId', '00000000-0000-4000-8000-0000000000f1'),
  );
  await page.route('**/v1/**', (route) =>
    route.fulfill({
      status: 500,
      json: { error: { code: 'internal', message: 'Something went wrong', ref: REF } },
    }),
  );
  await page.route('**/v1/client-errors', (route) => route.fulfill({ status: 204 }));
  await page.route('**/v1/student/feedback', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, json: {} });
  });

  await page.goto('/map');
  await expect(page.getByText(REF).first()).toBeVisible();

  await page.getByRole('button', { name: 'Report a bug' }).click();
  await page.getByRole('checkbox', { name: 'Include device details' }).check();
  await expect(page.getByText(`Problem code: ${REF}`)).toBeVisible();
  await page.getByRole('radio', { name: 'Bug' }).check();
  await page.getByLabel(/Tell us more/).fill('The map would not load');
  await page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]?.device?.lastProblem).toBe(REF);
});
