// Every subject's every unit route (with every bridge found) stays readable: no overlapping nodes or labels, labels on screen,
// road segments never cross, at 320px and 390px.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const issues = []; const shapes = {};
  for (const width of [320, 390]) {
    const p = await b.newPage({ viewport: { width, height: 800 } });
    await p.goto('file://' + require('path').resolve(process.argv[2] || 'all-themes-pip.html'));
    await p.click('[data-motion=reduced]'); // measure the resting layout
    await p.click('.nav a[data-go=map]');
    const subs = await p.$$eval('#subjectSeg button', (bs) => bs.map((x) => x.dataset.sub));
    for (const sub of subs) {
      await p.click(`#subjectSeg [data-sub=${sub}]`); await p.waitForTimeout(120);
      await p.evaluate(() => window.__mockFindAll && window.__mockFindAll()); // include every bridge, chains too
      const r = await p.evaluate(() => {
        const out = [];
        document.querySelectorAll('#pager .page').forEach((pg, u) => {
          const pr = pg.getBoundingClientRect();
          const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left - pr.left, r: r.right - pr.left, t: r.top, b: r.bottom }; };
          const nodes = [...pg.querySelectorAll('.node')].map(box), labels = [...pg.querySelectorAll('.node-label')].map(box);
          const hit = (a, c, pad = 0) => a.l < c.r - pad && c.l < a.r - pad && a.t < c.b - pad && c.t < a.b - pad;
          const all = [...nodes.map((x) => ['node', x]), ...labels.map((x) => ['label', x])];
          for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
            const sameNode = all[i][0] !== all[j][0] && Math.abs(i - (j - nodes.length)) === 0;
            if (!sameNode && hit(all[i][1], all[j][1], 1)) out.push(`unit ${u + 1}: ${all[i][0]} ${i} overlaps ${all[j][0]} ${j}`);
          }
          labels.forEach((x, i) => { if (x.l < -2 || x.r > pr.width + 2) out.push(`unit ${u + 1}: label ${i} off screen`); });
          // road crossings: sample each segment and test segment pairs that are not joined
          const paths = [...pg.querySelectorAll('.road .r, .road .rb, .road .rx')].flatMap((el) => (el.getAttribute('d') || '').split('M').filter(Boolean).map((d) => {
            const n = d.trim().split(/[\sC]+/).map(Number); const [ax, ay, c1x, c1y, c2x, c2y, bx, by] = n;
            return Array.from({ length: 25 }, (_, k) => { const t = k / 24, m = 1 - t; return [m * m * m * ax + 3 * m * m * t * c1x + 3 * m * t * t * c2x + t * t * t * bx, m * m * m * ay + 3 * m * m * t * c1y + 3 * m * t * t * c2y + t * t * t * by]; });
          }));
          const w = pg.querySelector('.trail').clientWidth / 100;
          const inter = (p1, p2, p3, p4) => { const d = (a, b, c) => (c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0]); const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4); return d1 * d2 < 0 && d3 * d4 < 0; };
          const sc = (pt) => [pt[0] * w, pt[1]];
          for (let i = 0; i < paths.length; i++) for (let j = i + 1; j < paths.length; j++) {
            const A = paths[i], B = paths[j]; const near = (P, Q) => Math.hypot((P[0] - Q[0]) * w, P[1] - Q[1]) < 30;
            if ([A[0], A[24]].some((P) => near(P, B[0]) || near(P, B[24]))) continue; // joined at a node
            let x = false; for (let s = 0; s < 24 && !x; s++) for (let t = 0; t < 24 && !x; t++) x = inter(sc(A[s]), sc(A[s + 1]), sc(B[t]), sc(B[t + 1]));
            if (x) out.push(`unit ${u + 1}: road segments ${i} and ${j} cross`);
          }
          out.push('#shape ' + pg.getAttribute('aria-label').split(': ')[1]);
        });
        return out;
      });
      r.filter((x) => x.startsWith('#shape')).forEach((x) => { const s = x.slice(7); shapes[s] = (shapes[s] || 0) + 1; });
      r.filter((x) => !x.startsWith('#shape')).forEach((x) => issues.push(`${width}px ${sub} ${x}`));
    }
    await p.close();
  }
  await b.close();
  console.log('route shapes used (both widths):', JSON.stringify(shapes));
  console.log(issues.length ? issues.join('\n') : 'no overlaps, no labels off screen, no road crossings');
  process.exitCode = issues.length ? 1 : 0;
})();
