import type { Page } from '@playwright/test';

/*
 * W21 tier 1: a fast contrast check from computed styles, with no screenshots. Each visible text
 * node is measured against the nearest opaque background found by walking up its ancestors (any
 * see-through backgrounds on the way are blended in). UI parts (buttons, inputs, switches, tabs)
 * are measured at 3:1 by their fill or their border against what is behind them (WCAG 1.4.11).
 *
 * Anything this cannot judge from styles alone is skipped and left to the painted sweep (tier 2):
 * a background image or gradient on the way up, a filter or blend mode, a box shadow standing in
 * for a border, or a control the browser draws itself (a native checkbox or radio).
 */

export interface ContrastFailure {
  kind: 'text' | 'ui';
  /** tag.class of the element, and of its nearest ancestor with a class when it has none. */
  where: string;
  /** The words (text) or the accessible name (UI), digits masked so dates do not churn keys. */
  label: string;
  ratio: number;
  needed: number;
}

export interface ContrastResult {
  failures: ContrastFailure[];
  /** Text nodes measured, and those left to the painted sweep. */
  checked: number;
  skipped: number;
}

export function computedContrastFailures(
  page: Page,
  { within }: { within?: string } = {},
): Promise<ContrastResult> {
  return page.evaluate((within) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    /** A computed colour as [r, g, b, alpha]; rgb()/rgba() is read directly, anything else via a canvas. */
    const rgba = (c: string): [number, number, number, number] => {
      const m = /^rgba?\(([^)]+)\)$/.exec(c.trim());
      if (m) {
        const v = m[1]!
          .split(/[\s,/]+/)
          .filter(Boolean)
          .map(Number);
        return [v[0]!, v[1]!, v[2]!, v[3] ?? 1];
      }
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
    };
    const over = (top: number[], below: number[]) => {
      const a = top[3]!;
      return [0, 1, 2].map((i) => top[i]! * a + below[i]! * (1 - a)).concat(1);
    };
    const lum = (c: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
    };
    const ratio = (a: number[], b: number[]) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m) as [number, number];
      return (x + 0.05) / (y + 0.05);
    };
    const NEEDS_PAINT = null;
    /** The opaque colour behind `el` (its own background included), or null if tier 2 must judge. */
    const behind = (el: Element | null): number[] | null => {
      const layers: number[][] = [];
      for (let a = el; a; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.backgroundImage !== 'none') return NEEDS_PAINT;
        if (
          cs.filter !== 'none' ||
          cs.mixBlendMode !== 'normal' ||
          (cs.backdropFilter && cs.backdropFilter !== 'none')
        )
          return NEEDS_PAINT;
        const bg = rgba(cs.backgroundColor);
        if (bg[3] > 0) layers.push(bg);
        if (bg[3] >= 0.999) break;
        if (a === document.documentElement) layers.push([255, 255, 255, 1]);
      }
      if (layers.length === 0) layers.push([255, 255, 255, 1]);
      let c = layers.pop()!;
      while (layers.length) c = over(layers.pop()!, c);
      return c;
    };
    const opacityOf = (el: Element) => {
      let o = 1;
      for (let a: Element | null = el; a; a = a.parentElement)
        o *= Number(getComputedStyle(a).opacity);
      return o;
    };
    const describe = (el: Element) => {
      const name = (e: Element) =>
        `${e.tagName.toLowerCase()}${Array.from(e.classList)
          .slice(0, 2)
          .map((c) => `.${c}`)
          .join('')}`;
      if (el.classList.length) return name(el);
      let a = el.parentElement;
      while (a && !a.classList.length) a = a.parentElement;
      return a ? `${name(a)} > ${name(el)}` : name(el);
    };
    const mask = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/\d/g, '#').slice(0, 40);
    const shown = (el: Element) => {
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || cs.display === 'none') return false;
      const r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    };
    const root = within ? document.querySelector(within) : document.body;
    if (!root) return { failures: [], checked: 0, skipped: 0 };
    const out: ContrastFailure[] = [];
    const stats = { checked: 0, skipped: 0 };

    // Text: every non-empty text node in an element that is drawn.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const seen = new Set<string>();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent?.trim() || !shown(el)) continue;
      if (el.closest('.visually-hidden, .sr-only, script, style, noscript, svg')) continue;
      // Text in a control that is switched off is exempt (WCAG 1.4.3, inactive UI).
      if (el.closest(':disabled, [aria-disabled="true"]')) continue;
      // A decorative emoji or picture glyph is not text (decision 0012); a symbol drawn as an
      // indicator (+, ›, ✓) is a graphic, so it needs 3:1, not 4.5:1.
      const words = n.textContent.trim();
      const glyphOnly = !/[\p{L}\p{N}]/u.test(words);
      if (glyphOnly && /\p{Extended_Pictographic}/u.test(words)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 2 && r.height > 2);
      if (rects.length === 0) continue;
      const cs = getComputedStyle(el);
      const back = behind(el);
      if (!back) {
        stats.skipped++;
        continue;
      }
      stats.checked++;
      if (
        cs.webkitTextFillColor &&
        cs.webkitTextFillColor !== cs.color &&
        rgba(cs.webkitTextFillColor)[3] === 0
      )
        continue; // gradient-clipped text: tier 2
      const ink = rgba(cs.color);
      const alpha = ink[3] * opacityOf(el);
      if (alpha === 0) continue;
      const shownInk = over([ink[0], ink[1], ink[2], alpha], back);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      const needed = large || glyphOnly ? 3 : 4.5;
      const r = ratio(shownInk, back);
      if (r + 1e-6 < needed) {
        const item = {
          kind: glyphOnly ? ('ui' as const) : ('text' as const),
          where: describe(el),
          label: mask(n.textContent),
          ratio: Math.round(r * 100) / 100,
          needed,
        };
        const key = `${item.where}|${item.label}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(item);
        }
      }
    }

    // UI parts (WCAG 1.4.11 as written, decision 0012): 3:1 against what is behind for anything
    // showing a state (selected, pressed, checked), input boundaries (text fields, selects,
    // custom checkboxes and radios) and icon-only controls. A text button whose words pass 4.5:1
    // needs no edge, so it is not measured here (its words are, above).
    const parts = root.querySelectorAll<HTMLElement>(
      'button, [role="button"], a, input:not([type="hidden"]), select, textarea, [role="switch"], [role="checkbox"], [role="radio"], [role="tab"]',
    );
    const visibleWords = (el: Element) =>
      Array.from(el.querySelectorAll('*'))
        .concat(el)
        .some((e) =>
          Array.from(e.childNodes).some(
            (c) =>
              c.nodeType === Node.TEXT_NODE &&
              /[\p{L}\p{N}]/u.test(c.textContent ?? '') &&
              !c.parentElement?.closest('.visually-hidden, .sr-only'),
          ),
        );
    for (const el of Array.from(parts)) {
      if (!shown(el) || el.closest('.visually-hidden, .sr-only')) continue;
      if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true')
        continue;
      const cs = getComputedStyle(el);
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
      const iconOnly = !field && !visibleWords(el);
      if (!field && !state && !iconOnly) continue;
      if (el.tagName === 'A' && !iconOnly) continue;
      if (
        el instanceof HTMLInputElement &&
        ['checkbox', 'radio', 'range', 'color', 'file'].includes(el.type) &&
        cs.appearance !== 'none'
      )
        continue; // drawn by the browser: tier 2
      if (cs.boxShadow !== 'none' || cs.backgroundImage !== 'none') continue; // tier 2
      const back = behind(el.parentElement);
      if (!back) continue;
      const fill = rgba(cs.backgroundColor);
      const sides = ['top', 'right', 'bottom', 'left'] as const;
      const borders = sides
        .filter((s) => parseFloat(cs.getPropertyValue(`border-${s}-width`)) >= 1)
        .filter((s) => cs.getPropertyValue(`border-${s}-style`) !== 'none')
        .map((s) => rgba(cs.getPropertyValue(`border-${s}-color`)))
        .filter((c) => c[3] > 0);
      const o = opacityOf(el);
      const candidates = [
        ...(fill[3] > 0 ? [over([fill[0], fill[1], fill[2], fill[3] * o], back)] : []),
        ...borders.map((c) => over([c[0], c[1], c[2], c[3] * o], back)),
      ];
      // An icon-only control can also be seen by its icon (drawn in currentColor).
      if (iconOnly) {
        const ink = rgba(cs.color);
        candidates.push(over([ink[0], ink[1], ink[2], ink[3] * o], fill[3] >= 0.999 ? fill : back));
      }
      if (candidates.length === 0) {
        if (field)
          candidates.push(back); // a field with no visible boundary at all: 1:1
        else continue;
      }
      const best = Math.max(...candidates.map((c) => ratio(c, back)));
      if (best + 1e-6 < 3) {
        const label =
          el.getAttribute('aria-label') ??
          (el as HTMLInputElement).labels?.[0]?.textContent ??
          el.textContent ??
          '';
        out.push({
          kind: 'ui',
          where: `${describe(el)}${state ? ' (selected)' : field ? ' (field)' : ' (icon)'}`,
          label: mask(label),
          ratio: Math.round(best * 100) / 100,
          needed: 3,
        });
      }
    }
    return { failures: out, ...stats };
  }, within);
}
