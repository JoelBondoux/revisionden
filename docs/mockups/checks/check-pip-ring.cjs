// Pip's ring (or its inner keyline) must still separate the disc from the page (3:1) when the disc carries soft flag colours.
const { chromium } = require('playwright');
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('file://' + require('path').resolve(process.argv[2] || 'all-themes-pip.html'));
  const themes = await p.$$eval('#themeSeg button', (bs) => bs.map((x) => x.dataset.theme));
  const out = [];
  for (const mode of ['light', 'dark']) { await p.click(`[data-mode=${mode}]`);
    for (const t of themes) { await p.click(`#themeSeg [data-theme=${t}]`);
      for (const sub of ['maths', 'french', 'german', 'spanish']) { await p.click(`#subjectSeg [data-sub=${sub}]`); await p.waitForTimeout(sub === 'maths' ? 450 : 450);
        const r = await p.evaluate(() => {
          const ctx = document.createElement('canvas').getContext('2d');
          const parse = (c) => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#000'; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
          const svg = document.querySelector('#pipBtn .pip');
          const ring = parse(getComputedStyle(svg.querySelector('.ring-back')).stroke);
          const key = svg.querySelector('.keyline') ? parse(getComputedStyle(svg.querySelector('.keyline')).stroke) : ring;
          const disc = parse(getComputedStyle(svg.querySelector('.disc')).fill);
          const g = svg.querySelector('.flag'); const a = g ? parseFloat(getComputedStyle(g).opacity) : 0;
          const bands = g ? [...g.querySelectorAll('rect')].map((x) => parse(x.getAttribute('fill'))) : [disc];
          const mix = (c) => c.slice(0, 3).map((v, i) => v * a + disc[i] * (1 - a));
          return { ring, key, cols: bands.map(mix) };
        });
        out.push({ mode, t, sub, min: Math.min(...r.cols.map((c) => Math.max(ratio(r.ring, c), ratio(r.key, c)))) });
      } } }
  await b.close();
  console.log('| Style | Mode | plain disc (Maths) | French | German | Spanish |\n|---|---|---|---|---|---|');
  for (const mode of ['light', 'dark']) for (const t of themes) { const row = out.filter((o) => o.mode === mode && o.t === t); console.log(`| ${t} | ${mode} | ${row.map((o) => o.min.toFixed(2) + (o.min < 3 ? ' **low**' : '')).join(' | ')} |`); }
})();
