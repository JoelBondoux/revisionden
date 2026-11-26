import type { Page } from '@playwright/test';

/*
 * The painted-page contrast check (J15s-b, J15s-c, J16b), shared by looks.spec and lesson.spec:
 * text is measured in its real colour against what is really painted behind it.
 */

/** Lets a style change's transitions start, then finish (endless motion aside). */
export async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)), // a cancelled one is settled too
    ),
  );
}

/**
 * J15s-b, J15s-c: every piece of text drawn straight on the page (no box of its own behind it)
 * must read AA on what is really painted behind it. Three more screenshots: the text hidden (the
 * page as painted, halos included), then drawn in black and in white; the pixels either one
 * changes are the letters, measured in the text's real colour against the hidden-text page.
 */
export async function paintedTextFailures(
  page: Page,
  { only }: { only?: string } = {},
): Promise<string[]> {
  const texts = await page.evaluate((only) => {
    const clear = (el: Element) => {
      const cs = getComputedStyle(el);
      return (
        (cs.backgroundColor === 'rgba(0, 0, 0, 0)' || cs.backgroundColor === 'transparent') &&
        cs.backgroundImage === 'none'
      );
    };
    const out: {
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      large: boolean;
      text: string;
    }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim() || el.closest('.visually-hidden')) continue;
      if (only) {
        // Chosen elements (the lesson's +XP and combo, J16b) are measured on whatever is behind
        // them, the arena included.
        if (!el.closest(only)) continue;
      } else {
        let onPage = true;
        for (let a: Element | null = el; a && a !== document.body; a = a.parentElement)
          if (!clear(a)) onPage = false;
        if (!onPage) continue;
      }
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      // Lines hidden by a line clamp or other clipping are not drawn, so clip each line box to
      // every ancestor that hides its overflow.
      const clips = [] as DOMRect[];
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const ac = getComputedStyle(a);
        if (ac.overflowX !== 'visible' || ac.overflowY !== 'visible')
          clips.push(a.getBoundingClientRect());
      }
      for (const box of Array.from(range.getClientRects())) {
        let [left, top, right, bottom] = [box.left, box.top, box.right, box.bottom];
        for (const c of clips) {
          left = Math.max(left, c.left);
          top = Math.max(top, c.top);
          right = Math.min(right, c.right);
          bottom = Math.min(bottom, c.bottom);
        }
        [left, top] = [Math.max(left, 0), Math.max(top, 0)];
        [right, bottom] = [Math.min(right, innerWidth), Math.min(bottom, innerHeight)];
        const r = { left, top, right, bottom, width: right - left, height: bottom - top };
        if (r.width < 4 || r.height < 4) continue;
        // Text under something else (the bottom nav, a sheet) is not on show.
        const hit = document.elementFromPoint(left + r.width / 2, top + r.height / 2);
        if (!hit || !(el.contains(hit) || hit.contains(el))) continue;
        if (r.right < 0 || r.left > innerWidth) continue;
        const size = parseFloat(cs.fontSize);
        out.push({
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
          color: cs.color,
          large: size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700),
          text: (n.textContent ?? '').trim().slice(0, 30),
        });
      }
    }
    return out;
  }, only);
  const shotWith = async (css: string) => {
    const tag = await page.addStyleTag({ content: css });
    await settle(page);
    const shot = await page.screenshot({ animations: 'disabled' });
    await tag.evaluate((el) => (el as HTMLElement).remove());
    return shot;
  };
  const fill = (c: string) =>
    `*, *::before, *::after { color: ${c} !important; -webkit-text-fill-color: ${c} !important; transition: none !important; }`;
  const without = await shotWith(fill('transparent'));
  const black = await shotWith(fill('#000'));
  const white = await shotWith(fill('#fff'));
  const bad = await page.evaluate(
    async ({ shots, texts }) => {
      const pixels = async (b64: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        const g = cv.getContext('2d')!;
        g.drawImage(img, 0, 0);
        return {
          w: img.width,
          h: img.height,
          d: g.getImageData(0, 0, img.width, img.height).data,
        };
      };
      const [B, K, W] = [await pixels(shots[0]!), await pixels(shots[1]!), await pixels(shots[2]!)];
      const A = B;
      const scale = A.w / innerWidth;
      const ctx = document.createElement('canvas').getContext('2d')!;
      const rgb = (c: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
      };
      const lum = (c: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
      };
      const ratio = (a: number[], b: number[]) => {
        const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m) as [number, number];
        return (x + 0.05) / (y + 0.05);
      };
      const out: string[] = [];
      for (const t of texts) {
        const ink = rgb(t.color);
        const a = ink[3]!;
        const samples: number[] = [];
        const x0 = Math.max(0, Math.floor(t.x * scale));
        const y0 = Math.max(0, Math.floor(t.y * scale));
        const x1 = Math.min(A.w, Math.ceil((t.x + t.w) * scale));
        const y1 = Math.min(A.h, Math.ceil((t.y + t.h) * scale));
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++) {
            const k = (y * A.w + x) * 4;
            const off = (S: { d: Uint8ClampedArray }) =>
              Math.abs(S.d[k]! - B.d[k]!) +
              Math.abs(S.d[k + 1]! - B.d[k + 1]!) +
              Math.abs(S.d[k + 2]! - B.d[k + 2]!);
            // A letter pixel: the text drawn in black or in white changes it, whatever its
            // real colour (so faint text is found too). Behind it is what was painted.
            if (off(K) < 60 && off(W) < 60) continue;
            const bg = [B.d[k]!, B.d[k + 1]!, B.d[k + 2]!];
            samples.push(
              ratio(
                [0, 1, 2].map((c) => ink[c]! * a + bg[c]! * (1 - a)),
                bg,
              ),
            );
          }
        // Visible, non-empty text always has letter pixels; finding none is a failure.
        if (samples.length < 8) {
          out.push(`"${t.text}" has too few letter pixels to check`);
          continue;
        }
        samples.sort((m, n) => m - n);
        const p10 = samples[Math.floor(samples.length * 0.1)]!;
        if (p10 < (t.large ? 3 : 4.5)) out.push(`"${t.text}" ${p10.toFixed(2)}`);
      }
      return [...new Set(out)];
    },
    { shots: [without, black, white].map((b) => b.toString('base64')), texts },
  );
  return bad;
}
