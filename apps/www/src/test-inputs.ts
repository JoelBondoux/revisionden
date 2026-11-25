/** Real repository inputs for the tests: the same files the build reads. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { SiteInputs } from './site.ts';

export const repoRoot = join(import.meta.dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8');

export const tokensCss = read('apps/web/src/design/tokens.css');

export const testInputs: SiteInputs = {
  tokensCss,
  siteCss: '.site { color: var(--color-text); }',
  fonts: { 'nunito-latin-400-normal.woff2': new Uint8Array([1]) },
  legalIndex: read('docs/LEGAL.md'),
  legalFiles: Object.fromEntries(
    readdirSync(join(repoRoot, 'docs/legal'))
      .filter((name) => name.endsWith('.md'))
      .map((name) => [name, read(`docs/legal/${name}`)]),
  ),
  pricingDoc: read('docs/PRICING.md'),
};
