/**
 * Builds the public site into apps/www/dist: `pnpm --filter @revisionden/www build`.
 * Reads the build variables (docs/ENVIRONMENTS.md), the web app's design tokens and the
 * Nunito font files, renders every page and writes the files. No client scripts.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSiteConfig } from './config.ts';
import { renderSite, type SiteInputs } from './site.ts';

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(here, '..', '..', '..');

/** Latin Nunito in the weights the tokens use (regular, bold, extra bold, black). */
const FONT_FILES = /^nunito-latin-(400|700|800|900)-normal\.woff2$/;

function readFonts(): Record<string, Uint8Array> {
  const require = createRequire(import.meta.url);
  const folder = join(dirname(require.resolve('@fontsource/nunito/package.json')), 'files');
  const fonts: Record<string, Uint8Array> = {};
  for (const name of readdirSync(folder).filter((file) => FONT_FILES.test(file))) {
    fonts[name] = readFileSync(join(folder, name));
  }
  return fonts;
}

export function readInputs(): SiteInputs {
  return {
    tokensCss: readFileSync(join(repoRoot, 'apps/web/src/design/tokens.css'), 'utf8'),
    siteCss: readFileSync(join(here, 'site.css'), 'utf8'),
    fonts: readFonts(),
    legalIndex: readFileSync(join(repoRoot, 'docs/LEGAL.md'), 'utf8'),
    legalFiles: Object.fromEntries(
      readdirSync(join(repoRoot, 'docs/legal'))
        .filter((name) => name.endsWith('.md'))
        .map((name) => [name, readFileSync(join(repoRoot, 'docs/legal', name), 'utf8')]),
    ),
    pricingDoc: readFileSync(join(repoRoot, 'docs/PRICING.md'), 'utf8'),
  };
}

export function buildSite(outDir: string, env: Record<string, string | undefined>): number {
  const config = readSiteConfig(env);
  const files = renderSite(config, readInputs());
  rmSync(outDir, { recursive: true, force: true });
  for (const [path, contents] of files) {
    const target = join(outDir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }
  return files.size;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const count = buildSite(join(here, '..', 'dist'), process.env);
  console.log(`Built the public site: ${count} files in apps/www/dist`);
}
