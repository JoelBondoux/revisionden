// Map track visibility check: every node state must stand out from the road and from the
// background by at least 3:1 (WCAG 1.4.11 non-text contrast), in every style, light and dark.
// Usage: node check-track-contrast.cjs path/to/all-themes-pip.html [--json]
const { chromium } = require('playwright');
const path = require('path');
const file = path.resolve(process.argv[2] || 'all-themes-pip.html');

const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const over = ([r, g, b, a], bg) => [r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), b * a + bg[2] * (1 - a)];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  await page.goto('file://' + file);
  await page.click('.nav a[data-go=map]');
  const themes = await page.$$eval('#themeSeg button', (bs) => bs.map((b) => b.dataset.theme));
  const rows = [];
  for (const mode of ['light', 'dark']) {
    await page.click(`[data-mode=${mode}]`);
    for (const theme of themes) {
      await page.click(`#themeSeg [data-theme=${theme}]`);
      await page.waitForTimeout(450);
      const info = await page.evaluate(() => {
        const ctx = document.createElement('canvas').getContext('2d');
        const parse = (c) => { // any CSS colour -> [r,g,b,a]
          if (!c || c === 'none' || c === 'transparent') return null;
          ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data; return d[3] ? [d[0], d[1], d[2], d[3] / 255] : null;
        };
        const colorsIn = (s) => (s.match(/(rgba?|color|hsla?)\([^)]*\)|#[0-9a-f]{3,8}\b/gi) || []).map(parse).filter(Boolean);
        const grad = [...document.querySelectorAll('#rainbow-grad stop')].map((s) => parse(s.getAttribute('stop-color')));
        const stroke = (el) => { const s = getComputedStyle(el).stroke; return s.startsWith('url') ? grad : [parse(s)].filter(Boolean); };
        const pg = document.querySelector('#pager .page');
        const road = stroke(pg.querySelector('.road .r')), done = stroke(pg.querySelector('.road .d'));
        const layers = (n) => { // what the eye can use to find the node: its halo, its border, its fill
          const cs = getComputedStyle(n); const out = [];
          const oc = parse(cs.outlineColor);
          if (parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none' && oc?.[3] > 0.5) out.push({ by: 'halo', c: [oc] });
          for (const m of cs.boxShadow.matchAll(/(rgba?\([^)]*\)) 0px 0px 0px ([\d.]+)px/g)) { // solid edge rings built into the tile
            const rc = parse(m[1]); if (parseFloat(m[2]) >= 2 && rc?.[3] > 0.5) { out.push({ by: 'edge ring', c: [rc] }); break; } }
          const art = n.querySelector('svg .edge'); // the node art's own outline (e.g. outlined petals)
          if (art) { const ac = parse(getComputedStyle(art).stroke); if (ac && ac[3] > 0.5) out.push({ by: 'art outline', c: [ac] }); }
          const bc = parse(cs.borderTopColor);
          if (parseFloat(cs.borderTopWidth) >= 2 && bc?.[3] > 0.5) out.push({ by: 'border', c: [bc] });
          if (cs.backgroundImage !== 'none') out.push({ by: 'fill', c: colorsIn(cs.backgroundImage) });
          else { const f = parse(cs.backgroundColor); if (f && f[3] > 0.2) out.push({ by: 'fill', c: [f] }); }
          return out;
        };
        const appCs = getComputedStyle(document.querySelector('#app'));
        const palette = ['--ink', '--card-bg', '--btn-bg', '--tag-bg'].map((v) => parse(appCs.getPropertyValue(v).trim())).filter((c) => c && c[3] > 0.9);
        const pick = (sel) => { const n = pg.querySelector(sel); return n ? layers(n) : null; };
        return { road, done, palette, states: { done: pick('.node.done'), current: pick('.node.current'), locked: pick('.node.locked:not(.quest)') } };
      });
      // background: hide the trail and sample the page's real pixels (textures included)
      await page.addStyleTag({ content: '#pager .trail > *{visibility:hidden!important}' });
      const shot = await page.locator('#pager').screenshot();
      await page.evaluate(() => document.querySelectorAll('style').forEach((s) => { if (s.textContent.includes('.trail > *{visibility:hidden')) s.remove(); }));
      const bgs = await page.evaluate(async (b64) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; const out = [];
        for (let y = 4; y < c.height; y += 23) for (let x = 4; x < c.width; x += 19) { const i = (y * c.width + x) * 4; out.push([d[i], d[i + 1], d[i + 2]]); }
        return out;
      }, shot.toString('base64'));
      const p10 = (vals) => vals.sort((x, y) => x - y)[Math.floor(vals.length * 0.1)];
      const layerVs = (L, b, X) => Math.min(...L.map((c) => ratio(c.length > 3 ? over(c, b) : c, X)));
      // A node is visible against a neighbouring colour if at least one of its rings (or its fill) clears it.
      const visible = (layersC, roads) => ({
        road: Math.min(...bgs.slice(0, 40).flatMap((b) => roads.flat().map((r) => { const X = over(r, b); return Math.max(0, ...layersC.map((L) => layerVs(L, b, X))); }))),
        bg: p10(bgs.map((b) => Math.max(0, ...layersC.map((L) => layerVs(L, b, b))))),
      });
      for (const st of ['done', 'current', 'locked']) {
        const ls = info.states[st]; if (!ls) continue;
        const roads = st === 'done' ? [info.done] : st === 'current' ? [info.done, info.road] : [info.road];
        const base = ls.map((l) => l.c);
        const v = visible(base, roads); const vsRoad = v.road, vsBg = v.bg;
        const by = ls.length ? ls.map((l) => l.by).join('+') : 'icon only';
        const pass = vsRoad >= 3 && vsBg >= 3;
        let fix = null;
        if (!pass) { // smallest fix from the style's own palette: one halo colour, else a two-tone ring
          const hex = (c) => '#' + c.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
          const cands = [...info.palette, [255, 255, 255, 1], [26, 22, 40, 1]];
          const ok = (cs) => { const w = visible([...base, ...cs.map((c) => [c])], roads); return w.road >= 3 && w.bg >= 3; };
          const one = cands.find((c) => ok([c]));
          if (one) fix = { h1: hex(one) };
          else for (const x of cands) { const y = cands.find((c) => c !== x && ok([x, c])); if (y) { fix = { h1: hex(x), h2: hex(y) }; break; } }
        }
        rows.push({ theme, mode, state: st, edge: by, vsRoad: +vsRoad.toFixed(2), vsBg: +vsBg.toFixed(2), pass, fix });
      }
    }
  }
  await browser.close();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(rows)); return; }
  if (process.argv.includes('--css')) { // the halo rules that make every failing row pass
    const sel = { done: '.node.done', current: '.node.current', locked: '.node.locked' };
    for (const r of rows.filter((x) => x.fix)) console.log(`${r.mode === 'dark' ? "[data-mode='dark'] " : ''}.t-${r.theme} ${sel[r.state]} { --h1: ${r.fix.h1};${r.fix.h2 ? ` --h2: ${r.fix.h2}; --h2w: 2.5px;` : ''} }`);
    return;
  }
  console.log('| Style | Mode | Node | Seen by | vs road | vs background | Result |\n|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.theme} | ${r.mode} | ${r.state} | ${r.edge} | ${r.vsRoad} | ${r.vsBg} | ${r.pass ? 'pass' : '**FAIL**'} |`);
  const fails = rows.filter((r) => !r.pass).length;
  console.log(`\n${rows.length - fails}/${rows.length} pass`);
  process.exitCode = fails ? 1 : 0;
})();
