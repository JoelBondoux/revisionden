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
  // A look's font loads the first time the look is shown: wait for it, and for the reflow it
  // brings, so text is not measured where it was before the font arrived (train #408).
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((done) =>
      requestAnimationFrame(() => requestAnimationFrame(() => done())),
    );
  });
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
      // Text in a control that is switched off is exempt (WCAG 1.4.3, inactive UI; W21).
      if (el.closest(':disabled, [aria-disabled="true"]')) continue;
      // Text in a closed <details> (outside its summary) has boxes but is not drawn (/help's
      // "More about …", J's report on the CI list); it is measured when the section is open.
      let folded = false;
      for (let d = el.closest('details'); d; d = d.parentElement?.closest('details') ?? null)
        if (!d.open && !el.closest('summary')?.parentElement?.isSameNode(d)) folded = true;
      if (folded) continue;
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
        // Only a line fully on screen is measured: one cut by the edge of the screen is measured
        // at another scroll stop, where it shows in full (stops overlap by a fifth of a screen).
        // A part-drawn line has too few letter pixels to judge (train #403).
        if (top < 0 || left < 0 || bottom > innerHeight || right > innerWidth) continue;
        const r = { left, top, right, bottom, width: right - left, height: bottom - top };
        if (r.width < 4 || r.height < 4) continue;
        // Text under something else (the bottom nav, a sheet) is not on show.
        const hit = document.elementFromPoint(left + r.width / 2, top + r.height / 2);
        if (!hit || !(el.contains(hit) || hit.contains(el))) continue;
        if (r.right < 0 || r.left > innerWidth) continue;
        const size = parseFloat(cs.fontSize);
        // SVG text's colour is its fill, when that is a plain colour.
        const svgInk = el instanceof SVGElement && /^rgb/.test(cs.fill) ? cs.fill : null;
        out.push({
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height,
          color: svgInk ?? cs.color,
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
  // SVG text (chart labels) is painted by `fill`, not `color`, so it is inked the same way (J's
  // report on the CI list: those labels were "too few letter pixels").
  const fill = (c: string) =>
    `*, *::before, *::after { color: ${c} !important; -webkit-text-fill-color: ${c} !important; transition: none !important; } svg text, svg tspan, svg textPath { fill: ${c} !important; stroke: none !important; }`;
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

/** Decodes a screenshot inside the page, for pixel sampling there. */
const PIXELS = `async (b64) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, d: g.getImageData(0, 0, img.width, img.height).data };
}`;

const UI_PARTS =
  'button, [role="button"], a, input:not([type="hidden"]), select, textarea, [role="switch"], [role="checkbox"], [role="radio"], [role="tab"]';

/**
 * W21 tier 2, WCAG 1.4.11: each UI part on screen must stand out 3:1 from what is painted around
 * it. With all text hidden, the colour just inside its edge (its border or fill, as drawn, shadows
 * and gradients included) is compared with the colour just outside, along the middle of each side.
 * A part with no fill, border or shadow (a text-only control) needs no edge and is not measured.
 */
export async function paintedUiFailures(page: Page, { within }: { within?: string } = {}) {
  const parts = await page.evaluate(
    ({ within, selector }) => {
      const hasWords = (el: Element) =>
        Array.from(el.querySelectorAll('*'))
          .concat(el)
          .some((e) =>
            Array.from(e.childNodes).some(
              (c) => c.nodeType === Node.TEXT_NODE && /[\p{L}\p{N}]/u.test(c.textContent ?? ''),
            ),
          );
      const root = within ? document.querySelector(within) : document.body;
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>(selector))
        .filter((el) => {
          const cs = getComputedStyle(el);
          if (cs.visibility !== 'visible' || (el as HTMLButtonElement).disabled) return false;
          // Hidden by opacity (a styled radio's real input, say): what shows is measured instead.
          for (let a: Element | null = el; a; a = a.parentElement)
            if (Number(getComputedStyle(a).opacity) === 0) return false;
          if (
            el.getAttribute('aria-disabled') === 'true' ||
            el.closest('.visually-hidden, .sr-only')
          )
            return false;
          const drawn =
            cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
            cs.backgroundImage !== 'none' ||
            cs.boxShadow !== 'none' ||
            parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth) > 0 ||
            // A checkbox or radio the browser draws itself.
            (el instanceof HTMLInputElement &&
              ['checkbox', 'radio'].includes(el.type) &&
              cs.appearance !== 'none');
          // WCAG 1.4.11 as written (decision 0012): a state, a field boundary, or an icon-only
          // control. A text button whose words pass needs no edge.
          const field =
            el instanceof HTMLSelectElement ||
            el instanceof HTMLTextAreaElement ||
            (el instanceof HTMLInputElement &&
              !['button', 'submit', 'reset', 'image'].includes(el.type));
          const state =
            el.getAttribute('aria-pressed') === 'true' ||
            el.getAttribute('aria-selected') === 'true' ||
            el.getAttribute('aria-checked') === 'true' ||
            (el instanceof HTMLInputElement && el.checked);
          const words = Array.from(el.querySelectorAll('*'))
            .concat(el)
            .some((e) =>
              Array.from(e.childNodes).some(
                (c) => c.nodeType === Node.TEXT_NODE && /[\p{L}\p{N}]/u.test(c.textContent ?? ''),
              ),
            );
          if (!field && !state && words) return false;
          // Map nodes are measured against the road and the page in map.spec.
          if (el.closest('.path-node')) return false;
          const r = el.getBoundingClientRect();
          // Something on top (the bottom nav, a header) hides it at this stop: it is measured at
          // a stop where it is uncovered (J, W21b), as covered text is.
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) return false;
          return (
            drawn &&
            r.width > 8 &&
            r.height > 8 &&
            r.top >= 4 &&
            r.left >= 4 &&
            r.bottom <= innerHeight - 4 &&
            r.right <= innerWidth - 4
          );
        })
        .map((el) => {
          const r = el.getBoundingClientRect();
          const name = (el.getAttribute('aria-label') ?? el.textContent ?? '')
            .replace(/\s+/g, ' ')
            .trim();
          return {
            icon: !el.matches('input, select, textarea') && !hasWords(el),
            // A state or a field boundary is judged by its edge; an icon-only control by its icon.
            edge:
              el.matches('input, select, textarea') ||
              ['aria-pressed', 'aria-selected', 'aria-checked'].some(
                (k) => el.getAttribute(k) === 'true',
              ) ||
              (el instanceof HTMLInputElement && el.checked),
            x: r.left,
            y: r.top,
            w: r.width,
            h: r.height,
            where: `${el.tagName.toLowerCase()}${Array.from(el.classList)
              .slice(0, 2)
              .map((c) => `.${c}`)
              .join('')}`,
            label: name.replace(/\d/g, '#').slice(0, 40),
          };
        });
    },
    { within, selector: UI_PARTS },
  );
  if (parts.length === 0) return [];
  const tag = await page.addStyleTag({
    content:
      '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; caret-color: transparent !important; }',
  });
  await settle(page);
  const shot = (await page.screenshot({ animations: 'disabled' })).toString('base64');
  await tag.evaluate((el) => (el as HTMLElement).remove());
  await settle(page);
  // Icons are drawn in currentColor, so an icon-only control is also seen as it really is.
  const plain = parts.some((p) => p.icon)
    ? (await page.screenshot({ animations: 'disabled' })).toString('base64')
    : shot;
  return page.evaluate(
    async ({ shot, plain, parts, decode }) => {
      const S = await (
        new Function(`return (${decode})`)() as (
          b: string,
        ) => Promise<{ w: number; h: number; d: Uint8ClampedArray }>
      )(shot);
      const scale = S.w / innerWidth;
      const at = (x: number, y: number) => {
        const k = (Math.round(y * scale) * S.w + Math.round(x * scale)) * 4;
        return [S.d[k]!, S.d[k + 1]!, S.d[k + 2]!];
      };
      const lum = (c: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
      };
      const median = (cs: number[][]) =>
        cs.map(lum).sort((a, b) => a - b)[Math.floor(cs.length / 2)]!;
      const out: string[] = [];
      const decode2 = new Function(`return (${decode})`)() as (
        b: string,
      ) => Promise<{ w: number; h: number; d: Uint8ClampedArray }>;
      const P = plain === shot ? S : await decode2(plain);
      const atIn = (I: typeof S, x: number, y: number) => {
        const k = (Math.round(y * scale) * I.w + Math.round(x * scale)) * 4;
        return [I.d[k]!, I.d[k + 1]!, I.d[k + 2]!];
      };
      const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      for (const p of parts) {
        // Each side on its own (an underline-only field has one edge that counts).
        const sides: [number[][], number[][]][] = [[], [], [], []].map(() => [[], []]) as never;
        for (let t = 0.3; t <= 0.7; t += 0.1) {
          const x = p.x + p.w * t;
          const y = p.y + p.h * t;
          sides[0]![0].push(at(x, p.y + 1.5));
          sides[0]![1].push(at(x, p.y - 3));
          sides[1]![0].push(at(x, p.y + p.h - 1.5));
          sides[1]![1].push(at(x, p.y + p.h + 3));
          sides[2]![0].push(at(p.x + 1.5, y));
          sides[2]![1].push(at(p.x - 3, y));
          sides[3]![0].push(at(p.x + p.w - 1.5, y));
          sides[3]![1].push(at(p.x + p.w + 3, y));
        }
        if (p.edge) {
          const best = Math.max(...sides.map(([i, o]) => contrast(median(i), median(o))));
          if (best < 3) out.push(`ui|${p.where}|${p.label} ${best.toFixed(2)}`);
        }
        if (p.icon) {
          // The icon against the control's own fill, whatever its edge does (Codex on train
          // #401). Both are read in the middle of the control, where its icon sits (clear of
          // rounded corners): the fill with icons hidden, the icon as the most distinct
          // twentieth of the pixels as really drawn.
          const middle: [number, number][] = [];
          for (let y = p.y + p.h * 0.2; y < p.y + p.h * 0.8; y += 1)
            for (let x = p.x + p.w * 0.2; x < p.x + p.w * 0.8; x += 1) middle.push([x, y]);
          const behind = median(middle.map(([x, y]) => at(x, y)));
          const inner = middle
            .map(([x, y]) => contrast(lum(atIn(P, x, y)), behind))
            .sort((a, b) => a - b);
          const icon = inner[Math.floor(inner.length * 0.95)] ?? 1;
          if (icon < 3) out.push(`ui|${p.where} (icon)|${p.label} ${icon.toFixed(2)}`);
        }
      }
      return [...new Set(out)];
    },
    { shot, plain, parts, decode: PIXELS },
  );
}

/**
 * W21 tier 2, WCAG 1.4.11 and 2.4.7: the focus ring on the first few controls in tab order
 * must show (some pixels change around the control) and stand out 3:1 from what was there before.
 */
export async function focusRingFailures(page: Page, count = 3) {
  const out: string[] = [];
  // The first few controls on screen, in tab order, each focused as a keyboard user would see it
  // (focusVisible), so the result does not depend on where an earlier click left focus.
  const targets = await page.evaluate((count) => {
    const all = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]',
      ),
    ).filter((el) => {
      if (el.tabIndex < 0 || (el as HTMLButtonElement).disabled) return false;
      if (el.closest('[inert], [aria-hidden="true"]')) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || cs.display === 'none') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top >= 8 && r.bottom <= innerHeight - 8;
    });
    // A modal dialog keeps focus inside it.
    const modal = document.querySelector('dialog[open]');
    const inScope = modal ? all.filter((el) => modal.contains(el)) : all;
    const ordered = [
      ...inScope.filter((el) => el.tabIndex > 0).sort((p, q) => p.tabIndex - q.tabIndex),
      ...inScope.filter((el) => el.tabIndex === 0),
    ];
    return ordered.slice(0, count).map((el, i) => {
      el.dataset.w21Focus = String(i);
      return i;
    });
  }, count);
  for (const i of targets) {
    const box = await page.evaluate((i) => {
      const el = document.querySelector<HTMLElement>(`[data-w21-focus="${i}"]`)!;
      (document.activeElement as HTMLElement | null)?.blur();
      el.focus({ focusVisible: true } as FocusOptions);
      // A control drawn by something else (a styled radio's real input, at opacity 0 or no size)
      // shows its ring on what is drawn: its label, or the nearest visible ancestor.
      const unseen = (e: Element) => {
        const r = e.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return true;
        for (let a: Element | null = e; a; a = a.parentElement)
          if (Number(getComputedStyle(a).opacity) === 0) return true;
        return false;
      };
      let shown: Element = el;
      if (unseen(el)) {
        const label = (el as HTMLInputElement).labels?.[0] ?? el.closest('label');
        shown = label && !unseen(label) ? label : el;
        for (
          let a = el.parentElement;
          shown === el && a && a !== document.body;
          a = a.parentElement
        )
          if (!unseen(a)) shown = a;
      }
      const r = shown.getBoundingClientRect();
      const name = (el.getAttribute('aria-label') ?? shown.textContent ?? el.tagName)
        .replace(/\s+/g, ' ')
        .trim();
      return {
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        label: name.replace(/\d/g, '#').slice(0, 40),
      };
    }, i);
    await settle(page);
    const on = (await page.screenshot({ animations: 'disabled' })).toString('base64');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await settle(page);
    const off = (await page.screenshot({ animations: 'disabled' })).toString('base64');
    const verdict = await page.evaluate(
      async ({ on, off, box, decode }) => {
        const dec = new Function(`return (${decode})`)() as (
          b: string,
        ) => Promise<{ w: number; h: number; d: Uint8ClampedArray }>;
        const [A, B] = [await dec(on), await dec(off)];
        const scale = A.w / innerWidth;
        const lum = (c: number[]) => {
          const f = (v: number) =>
            (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
        };
        const ratios: number[] = [];
        const pad = 8;
        for (let y = Math.max(0, box.y - pad); y < box.y + box.h + pad; y++)
          for (let x = Math.max(0, box.x - pad); x < box.x + box.w + pad; x++) {
            const k = (Math.round(y * scale) * A.w + Math.round(x * scale)) * 4;
            const a = [A.d[k]!, A.d[k + 1]!, A.d[k + 2]!];
            const b = [B.d[k]!, B.d[k + 1]!, B.d[k + 2]!];
            if (Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!) < 30)
              continue;
            const [m, n] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
            ratios.push((m + 0.05) / (n + 0.05));
          }
        if (ratios.length < 10) return 'no visible focus ring';
        ratios.sort((p, q) => p - q);
        const p90 = ratios[Math.floor(ratios.length * 0.9)]!;
        return p90 < 3 ? `focus ring ${p90.toFixed(2)}` : null;
      },
      { on, off, box, decode: PIXELS },
    );
    if (verdict) out.push(`focus|${box.label}|${verdict}`);
  }
  return out;
}
