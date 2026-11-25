/**
 * Draws the Open Graph card (1200×630) and the Apple touch icon (180×180) as PNGs from Pip's
 * shapes and the design tokens, with Chromium (Playwright). Run by hand after changing the art:
 *   node apps/www/scripts/make-images.mjs
 * The PNGs are committed in apps/www/public; the build copies them. Original art only.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public');
const require = createRequire(import.meta.url);
const fontDir = join(dirname(require.resolve('@fontsource/nunito/package.json')), 'files');
const font = (weight) =>
  readFileSync(join(fontDir, `nunito-latin-${weight}-normal.woff2`)).toString('base64');
const { PIP_SHAPES } = await import(join(here, '..', 'src', 'pip.ts'));

const eyes = `<polyline points="38,60 45,54 52,60" fill="none" stroke="#3A2622" stroke-width="4"/>
<polyline points="68,60 75,54 82,60" fill="none" stroke="#3A2622" stroke-width="4"/>
<polygon points="53,90 67,90 60,98" fill="#3A2622"/>`;
const pipSvg = (size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 120 120">${PIP_SHAPES}${eyes}</svg>`;

const style = `<style>
@font-face{font-family:N;font-weight:800;src:url(data:font/woff2;base64,${font(800)})}
@font-face{font-family:N;font-weight:900;src:url(data:font/woff2;base64,${font(900)})}
*{margin:0;box-sizing:border-box}body{font-family:N}</style>`;

// Arena palette (tokens.css): deep purple, neon accents, hexagon pattern like the topic map.
const hex = (x, y, r, fill, opacity) => {
  const points = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${points}" fill="${fill}" opacity="${opacity}"/>`;
};
const hexes = [
  hex(1010, 120, 70, '#6c47f5', 0.55),
  hex(1130, 190, 52, '#3df5c8', 0.35),
  hex(1080, 300, 44, '#ffc83d', 0.4),
  hex(1150, 420, 64, '#8b6cff', 0.45),
  hex(990, 520, 48, '#ff6fb5', 0.35),
  hex(1110, 580, 40, '#3df5c8', 0.3),
].join('');

const og = `<!doctype html><html><head>${style}</head><body>
<div style="position:relative;width:1200px;height:630px;background:#1a1033;color:#fff;overflow:hidden">
  <svg style="position:absolute;inset:0" width="1200" height="630">${hexes}</svg>
  <div style="position:absolute;left:80px;top:90px;width:640px">
    <div style="display:flex;align-items:center;gap:20px;margin-bottom:40px">${pipSvg(96)}
      <span style="font-size:52px;font-weight:900">RevisionDen</span></div>
    <div style="font-size:64px;font-weight:900;line-height:1.1">Revision that finds the gaps</div>
    <div style="margin-top:28px;font-size:32px;font-weight:800;color:#c9bef0">A family revision tutor for GCSE and <span style="white-space:nowrap">A-Level</span></div>
  </div>
  <div style="position:absolute;left:740px;top:170px">${pipSvg(300)}</div>
</div></body></html>`;

const icon = `<!doctype html><html><head>${style}</head><body>
<div style="width:180px;height:180px;background:#6c47f5;display:grid;place-items:center">${pipSvg(150)}</div>
</body></html>`;

const browser = await chromium.launch();
for (const [name, html, width, height] of [
  ['og.png', og, 1200, 630],
  ['apple-touch-icon.png', icon, 180, 180],
]) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(join(out, name), await page.screenshot({ type: 'png' }));
  await page.close();
}
await browser.close();
console.log('Wrote og.png and apple-touch-icon.png to apps/www/public');
