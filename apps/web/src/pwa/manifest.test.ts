import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'manifest.webmanifest'), 'utf8'),
) as { start_url: string; scope: string };

describe('PWA manifest', () => {
  it('starts and stays on whichever host serves the app (app., dev. or staging.)', () => {
    // Relative to the manifest, so the installed app opens app.revisionden.com in production and
    // never the public site on the bare domain.
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.start_url).not.toMatch(/^https?:/);
    expect(manifest.scope).not.toMatch(/^https?:/);
  });
});
