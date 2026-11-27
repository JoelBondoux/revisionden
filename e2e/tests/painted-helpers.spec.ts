import { expect, test, type Page } from '@playwright/test';
import { computedContrastFailures } from './support/contrastStyles';
import { focusRingFailures, paintedTextFailures, paintedUiFailures } from './support/painted';

/*
 * W21: the painted helpers on small made-up pages, so their rules are pinned down apart from the
 * app. A styled answer hides its real radio (opacity 0) and draws the focus ring on the visible
 * label; the ring must be looked for there, and a label with no ring must still fail. An
 * icon-only button is judged by its icon against its own fill, whatever its edge does (Codex on
 * train #401): a dark icon on a dark fill fails even when the fill stands out from the page.
 */

test.skip(({ isMobile, hasTouch }) => hasTouch && !isMobile, 'helper checks (phone and desktop)');

async function answers(page: Page, labelRing: boolean) {
  await page.setContent(`
    <style>
      body { margin: 0; padding: 40px; background: #fff; font: 16px sans-serif; }
      .answer { display: block; position: relative; margin: 24px 0; padding: 16px; border-radius: 12px;
                background: #f1f1f4; color: #222; }
      .answer input { position: absolute; opacity: 0; pointer-events: none; }
      ${labelRing ? '.answer:has(input:focus-visible) { outline: 3px solid #1a3ad6; outline-offset: 2px; }' : ''}
      input:focus { outline: none; }
    </style>
    <label class="answer"><input type="radio" name="a"> Option A</label>
    <label class="answer"><input type="radio" name="a"> Option B</label>
  `);
}

test.describe('focus rings on a hidden radio', { tag: '@contrast' }, () => {
  test('a ring drawn on the visible label counts', async ({ page }) => {
    await answers(page, true);
    expect(await focusRingFailures(page, 2)).toEqual([]);
  });

  test('a label with no ring still fails', async ({ page }) => {
    await answers(page, false);
    const found = await focusRingFailures(page, 2);
    expect(found).toHaveLength(2);
    expect(found.every((f) => f.endsWith('no visible focus ring'))).toBe(true);
  });
});

/** An icon-only button on a white page: a dark fill, with the icon in `icon`. */
async function iconButton(page: Page, icon: string) {
  await page.setContent(`
    <style>
      body { margin: 0; padding: 40px; background: #fff; }
      button { width: 48px; height: 48px; border: 0; border-radius: 12px; background: #111;
               color: ${icon}; display: grid; place-items: center; padding: 0; }
    </style>
    <button class="icon-button" aria-label="Close">
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5 L19 19 M19 5 L5 19" stroke="currentColor" stroke-width="3" />
      </svg>
    </button>
  `);
}

test.describe(
  'an icon-only button is judged by its icon on its own fill',
  { tag: '@contrast' },
  () => {
    test('a black icon on a black fill fails, though the fill stands out from the page', async ({
      page,
    }) => {
      await iconButton(page, '#000');
      const computed = await computedContrastFailures(page);
      expect(computed.failures.map((f) => `${f.where}|${f.label}`)).toEqual([
        'button.icon-button (icon)|Close',
      ]);
      const painted = await paintedUiFailures(page);
      expect(painted).toHaveLength(1);
      expect(painted[0]).toMatch(/^ui\|button\.icon-button \(icon\)\|Close /);
    });

    test('a white icon on the same fill passes', async ({ page }) => {
      await iconButton(page, '#fff');
      expect((await computedContrastFailures(page)).failures).toEqual([]);
      expect(await paintedUiFailures(page)).toEqual([]);
    });
  },
);

test.describe('text cut off by the edge of the screen', { tag: '@contrast' }, () => {
  /** Dark, plainly readable text (16px on 36px lines, with room above and below the letters), its line at 1000px down a tall page. */
  async function line(page: Page) {
    await page.setContent(`
      <style>
        body { margin: 0; background: #fff; font: 16px/36px sans-serif; color: #111; }
        p { position: absolute; left: 20px; top: 1000px; margin: 0; }
      </style>
      <p>The Me page is simpler and you</p>
      <div style="height: 4000px"></div>
    `);
  }
  const scrollTo = (page: Page, top: number) =>
    page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);

  for (const shown of [4, 5, 6, 8, 10]) {
    test(`a line cut by the top of the screen to ${shown}px is left for another scroll stop`, async ({
      page,
    }) => {
      await line(page);
      await scrollTo(page, 1000 + 36 - shown);
      expect(await paintedTextFailures(page)).toEqual([]);
    });

    test(`a line cut by the bottom of the screen to ${shown}px is left for another scroll stop`, async ({
      page,
    }) => {
      await line(page);
      await page.evaluate(
        (y) => window.scrollTo({ top: 1000 + y - innerHeight, behavior: 'instant' }),
        shown,
      );
      expect(await paintedTextFailures(page)).toEqual([]);
    });
  }

  test('the same line in full is measured, and passes', async ({ page }) => {
    await line(page);
    await scrollTo(page, 900);
    expect(await paintedTextFailures(page)).toEqual([]);
  });
});

test.describe(
  'only what is fully on show is measured at a scroll stop',
  { tag: '@contrast' },
  () => {
    test('faint text cut by the edge of the screen waits for a stop where it shows in full', async ({
      page,
    }) => {
      // Too faint to pass (#ccc on white), half off the bottom of the screen.
      await page.setContent(`
      <style>
        body { margin: 0; background: #fff; font: 16px/24px sans-serif; }
        p { position: absolute; left: 20px; margin: 0; color: #ccc; }
      </style>
      <p id="faint">Faint words that do not pass</p>
      <div style="height: 3000px"></div>
    `);
      await page.evaluate(() => {
        document.getElementById('faint')!.style.top = `${innerHeight - 10}px`;
      });
      expect(await paintedTextFailures(page)).toEqual([]);
      // In full, it is found.
      await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'instant' }));
      expect(await paintedTextFailures(page)).toHaveLength(1);
    });

    test('a text box under a fixed bar waits for a stop where it is uncovered', async ({
      page,
    }) => {
      await page.setContent(`
      <style>
        body { margin: 0; background: #fff; font: 16px sans-serif; }
        input { position: absolute; left: 20px; width: 200px; height: 40px; border: 3px solid #555;
                background: #fff; }
        nav { position: fixed; left: 0; right: 0; bottom: 0; height: 80px; background: #fff; }
      </style>
      <label>Name <input id="name"></label>
      <nav aria-label="Bottom bar"></nav>
      <div style="height: 3000px"></div>
    `);
      await page.evaluate(() => {
        document.getElementById('name')!.style.top = `${innerHeight - 70}px`;
      });
      expect(await paintedUiFailures(page)).toEqual([]);
    });
  },
);
