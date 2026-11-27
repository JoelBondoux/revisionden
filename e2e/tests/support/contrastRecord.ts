import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * W21b: where one tier 2 test differs from the known list, for CI's log (CONTRAST_RECORD=1):
 * the rows it found that are not listed, and the listed rows it no longer finds. A test that
 * matches the list removes the file, so a clean retry does not leave the failed attempt's
 * differences behind under the same name (Codex on #408).
 */
export function recordDifferences(file: string, fresh: Record<string, string>, fixed: string[]) {
  if (!Object.keys(fresh).length && !fixed.length) {
    rmSync(file, { force: true });
    return;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ new: fresh, fixed }, null, 2));
}
