import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/** The WCAG 2.2 A and AA rule sets every accessibility check uses. */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Waits for every finite animation on the page to end. Endless ones (the gentle pulse, Pip's
 * idle) never finish, so they are left out.
 */
export async function waitForAnimations(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

/**
 * Runs axe once the page has stopped animating in. Axe measures colours as drawn, so a button
 * still fading in reads paler than it is (a flaky 4.44:1 instead of 4.5:1, W10). The rules are
 * unchanged: WCAG 2.2 AA by default, or whatever `configure` sets.
 */
export async function axeWhenSettled(
  page: Page,
  configure: (builder: AxeBuilder) => AxeBuilder = (builder) => builder.withTags(WCAG_TAGS),
) {
  await waitForAnimations(page);
  return configure(new AxeBuilder({ page })).analyze();
}
