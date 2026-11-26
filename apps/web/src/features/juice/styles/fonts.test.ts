import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Lead check on #288 (2026-11-26): every self-hosted font ships with its licence. The fonts come
// from @fontsource and are bundled into the app, so each licence text is published beside them.
const web = join(import.meta.dirname, '../../../..');
const deps = Object.keys(
  (JSON.parse(readFileSync(join(web, 'package.json'), 'utf8')) as { dependencies: object })
    .dependencies,
).filter((name) => name.startsWith('@fontsource/'));

describe('self-hosted fonts', () => {
  it('includes the heading fonts of every style', () => {
    expect(deps).toEqual(
      expect.arrayContaining([
        '@fontsource/baloo-2',
        '@fontsource/bangers',
        '@fontsource/press-start-2p',
        '@fontsource/patrick-hand',
        '@fontsource/fredoka',
        '@fontsource/russo-one',
      ]),
    );
  });

  it.each(deps)('%s ships with its SIL Open Font Licence', (name) => {
    const file = join(web, 'public/licences/fonts', `${name.replace('@fontsource/', '')}-OFL.txt`);
    expect(existsSync(file), file).toBe(true);
    expect(readFileSync(file, 'utf8')).toContain('SIL Open Font License, Version 1.1');
  });
});
