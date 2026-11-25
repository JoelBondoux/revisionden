import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPEARANCE_KEY } from './settings';

/**
 * public/appearance-boot.js runs before the app (a plain script in index.html's <head>), so the
 * saved theme applies before the first paint: no flash of the wrong theme.
 */
const script = readFileSync(join(__dirname, '../../../public/appearance-boot.js'), 'utf8');
const html = readFileSync(join(__dirname, '../../../index.html'), 'utf8');

function boot(saved: string | null, prefersDark: boolean, storageThrows = false) {
  const root = document.createElement('html');
  const win = {
    localStorage: {
      getItem: (k: string) => {
        if (storageThrows) throw new Error('blocked');
        return k === APPEARANCE_KEY ? saved : null;
      },
    },
    matchMedia: (q: string) => ({ matches: prefersDark && q.includes('dark') }),
  };
  new Function('window', 'document', script)(win, { documentElement: root });
  return root;
}

describe('appearance boot script', () => {
  it('is loaded from index.html head, before the app, from our own site', () => {
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toContain('<script src="/appearance-boot.js"></script>');
  });

  it('applies the saved theme, colours and pattern before first paint', () => {
    const root = boot(
      JSON.stringify({ theme: 'dark', palette: 'colourblind', pattern: 'off' }),
      false,
    );
    expect(root.dataset).toMatchObject({ theme: 'dark', palette: 'colourblind', pattern: 'off' });
  });

  it('follows the device when nothing is saved', () => {
    expect(boot(null, true).dataset.theme).toBe('dark');
    expect(boot(null, false).dataset.theme).toBe('light');
    expect(boot(null, false).dataset.pattern).toBe('on');
  });

  it('never breaks the page on bad or blocked storage', () => {
    expect(boot('{oops', true).dataset.theme).toBe('dark');
    expect(boot(null, false, true).dataset.theme).toBe('light');
    expect(boot(JSON.stringify({ theme: 'neon', palette: 'x' }), false).dataset).toMatchObject({
      theme: 'light',
      palette: 'standard',
    });
  });
});
